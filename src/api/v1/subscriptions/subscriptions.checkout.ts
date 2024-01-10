import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { validateSchema } from "../../../util/validation";
import { getPaddleURL, isPaddleSetup } from "./subscriptions.core";
import moment from "moment";
import { createHmac } from "crypto";
import { nameToPriceId, reportPaddleError } from "./subscriptions.utils";
import { getPaddleRequestOptions, getRequestPaddle, patchRequestPaddle, postRequestPaddle } from "./subscriptions.http";
import axios from "axios";

export const startCheckoutSession = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    if (process.env.PADDLE_MAX_SUBS) {
        const maxSubs: number = parseInt(process.env.PADDLE_MAX_SUBS);
        if (maxSubs && maxSubs > 0) {
            const numSubs: number = await getCollection("subscribers").countDocuments({ subscriptionId: { $ne: null } })
            if (numSubs >= maxSubs) {
                // 401 isn't correct.. what else can we use?
                res.status(401).send("Simply Plus is currently limiting the amount of subscribers. The limit has been reached, try again when Simply Plus if fully released.");
                return;
            }
        }
    }

    const ts : number = moment.now()
    const uid : string = res.locals.uid
    const priceId : string = nameToPriceId(req.body.price)

    const value : string = uid + priceId + ts.toString()

    const hmac = createHmac('sha256', process.env.PADDLE_HMAC_KEY!)
    hmac.update(value)
    const digest = hmac.digest('hex')

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        const result = await getRequestPaddle(`customers/${subscriber.customerId}`)
        if (!result.success)
        {
            reportPaddleError(subscriber.uid, "Fetching a customer object")
            res.status(500).send("Something went wrong trying to start a checkout session")
            return
        }

        res.status(200).send({uid, priceId, ts, hmac: digest, customerId: subscriber.customerId, email: result.data.email})
    }
    else {
        if (!req.body.email)
        {
            res.status(400).send('User does not yet have a paddle customerId, starting a checkout session requires an email')
            return
        }

        const findEmailCustomerResult = await axios.get(`${getPaddleURL()}/customers?search=${req.body.email}`, getPaddleRequestOptions()).catch((error) => undefined)
        if (!findEmailCustomerResult)
        {
            reportPaddleError(subscriber.uid, "Finding a customer object")
            res.status(500).send("Something went wrong trying to start a checkout session")
            return
        }

        let customerId : string;

        // Found existing one that's not linked up to us, let's connect
        if (findEmailCustomerResult.status === 200 && findEmailCustomerResult.data.data.length === 1)
        {
            customerId = findEmailCustomerResult.data.data[0].id
            
            const result = await patchRequestPaddle(`customers/${customerId}`, { custom_data: { uid: res.locals.uid } })
            if (result.status !== 200)
            {
                reportPaddleError(res.locals.uid, "Updating a customer object")
                res.status(500).send("Something went wrong trying to start a checkout session")
                return
            }
           
            await getCollection('subscribers').insertOne({uid: res.locals.uid, customerId})
        }
        else 
        {
            const result = await postRequestPaddle(`customers`, {email: req.body.email, custom_data: { uid: res.locals.uid }})
            if (result.status !== 200)
            {
                reportPaddleError(res.locals.uid, "Creating a customer object")
                res.status(500).send("Something went wrong trying to start a checkout session")
                return
            }
    
            customerId = result.data.id
   
            await getCollection('subscribers').insertOne({uid: res.locals.uid, customerId })    
        }
       
        res.status(200).send({uid, priceId, ts, hmac: digest, customerId, email: req.body.email})
    }
};

export const validateCheckoutSessionSchema = (body: unknown): { success: boolean; msg: string } => {
    const schema = {
        type: "object",
        properties: {
            price: {
                type: "string",
                pattern: "^(affordable|regular|pif)$"
            },
            email: {
                type: "string",
                format: "email",
            }
        },
        nullable: false,
        additionalProperties: false,
        required: ["price"],
    };

    return validateSchema(schema, body);
};

