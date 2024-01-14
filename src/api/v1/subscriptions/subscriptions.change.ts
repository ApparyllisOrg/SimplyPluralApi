import { Request, Response } from "express";
import {isLemonSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription } from "../../../modules/mail/mailTemplates";
import { nameToPriceId, reportLemonError } from "./subscriptions.utils";
import assert from "node:assert";
import accounting from "accounting"
import { getRequestLemon, patchRequestLemon, postRequestLemon } from "./subscriptions.http";

export const changeSubscription = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (!subscriber.subscriptionId) {
            res.status(404).send()
            return
        }
  
        const existingSubscription = await getRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}`)

        assert(existingSubscription.success === true)

        const existingSubData : any = existingSubscription.data.data
        const existingSubAttributes = existingSubData.attributes

        if (existingSubAttributes.status === "cancelled")
        {
            res.status(400).send("Subscription is cancelled, cannot change plan")
            return
        }

        const priceId = nameToPriceId(req.body.price) 

        const reactivateResult = await patchRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}`, {
            data: 
            {
                id: subscriber.subscriptionId.toString(),
                type: "subscriptions",
                attributes: {
                    variant_id: priceId,
                    disable_prorations: true
                  }
            }
        })

        if (reactivateResult.status !== 200)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(reactivateResult)
            }
            reportLemonError(subscriber.uid, "Request reactivating subcription to lemon")
            res.status(500).send("Something went wrong trying to reactivate your subscription")
            return
        }

        res.status(200).send("Changed subscription")
    }
    else {
        res.status(404).send()
    }
};

export const validateChangeSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
    const schema = {
        type: "object",
        properties: {
            price: {
                type: "string",
                pattern: "^(affordable|regular|pif|pwyw)$"
            },
        },
        nullable: false,
        additionalProperties: false,
        required: ["price"],
    };

    return validateSchema(schema, body);
};
