import e, { Request, Response } from "express";
import { getCustomerFromUser, isCatSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import assert from "node:assert";
import moment from "moment";

export const catCallback = async (req: Request, res: Response) => {
    
    if (!isCatSetup()) {
        res.status(404).send("API is not cat enabled")
        return
    }

    if (process.env.DEVELOPMENT)
    {
        console.log("Received callback")
    }

    const authHeader : string | undefined = req.headers['authorization']?.toString() 

    if (authHeader === undefined) {
        res.status(400).send()
        return;
    }

    if (authHeader !== process.env.CAT_WEBHOOK_SECRET)
    {
        res.status(400).send()
        return;
    }

    let event = JSON.parse(req.body).event;

    if (process.env.DEVELOPMENT) {

      console.log(event)
    }

    switch (event.type) {
        case 'INITIAL_PURCHASE':
        {
            const uid : string = event.app_user_id
        
            if (!uid)
            {
                res.status(400).send("Missing uid")
                return 
            }

            const account = await getCollection("accounts").findOne({uid})
            assert(account)

            const customer = await getCustomerFromUser(uid)
            if (!customer)
            {
                await getCollection("subscribers").insertOne( { uid: uid } )
            }


            getCollection("users").updateOne({ uid: uid, _id: uid }, { $set: { plus: true } })
            getCollection("subscribers").updateOne({ uid: uid }, { $set: { product: event.product_id, periodEnd: event.expiration_at_ms} })

            break;
        }
        case 'EXPIRATION':
        {
            const uid : string = event.original_app_user_id
        
            if (!uid)
            {
                res.status(400).send("Missing uid")
                return 
            }

            const account = await getCollection("accounts").findOne({uid})
            assert(account)

            const customer = await getCustomerFromUser(uid)
            assert(customer)
    
            getCollection("users").updateOne({ uid: uid, _id: uid }, { $set: { plus: false } })
            getCollection("subscribers").updateOne({ _id: customer._id }, { $set: { product: null } })

            break;
        }
        case 'RENEWAL':
        {
            const uid : string = event.original_app_user_id
        
            if (!uid)
            {
                res.status(400).send("Missing uid")
                return 
            }

            const account = await getCollection("accounts").findOne({uid})
            assert(account)

            const customer = await getCustomerFromUser(uid)
            assert(customer)

            getCollection("subscribers").updateOne({ uid: uid }, { $set: { product: event.product_id, periodEnd: event.expiration_at_ms } })

            break;
        }
        case 'PRODUCT_CHANGE':
        {
            const uid : string = event.original_app_user_id
        
            if (!uid)
            {
                res.status(400).send("Missing uid")
                return 
            }

            const account = await getCollection("accounts").findOne({uid})
            assert(account)

            const customer = await getCustomerFromUser(uid)
            assert(customer)

            getCollection("subscribers").updateOne({ uid: uid }, { $set: { product: event.new_product_id } })

            break;
        }
    }

    res.status(200).send()
};
