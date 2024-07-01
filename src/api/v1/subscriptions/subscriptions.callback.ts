import e, { Request, Response } from "express";
import { getCustomerIdFromUser, isLemonSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_createdSubscription, mailTemplate_failedPaymentCancelSubscription } from "../../../modules/mail/mailTemplates";
import { logger } from "../../../modules/logger";
import assert from "node:assert";
import * as crypto from "crypto";
import moment from "moment";
import * as Sentry from "@sentry/node";
import { ERR_SUBSCRIPTION_POTENTIALLYMALICIOUS } from "../../../modules/errors";
import { postRequestLemon } from "./subscriptions.http";

export const lemonCallback = async (req: Request, res: Response) => {
    
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled")
        return
    }

    if (process.env.DEVELOPMENT)
    {
        console.log("Received callback")
    }

    const lemonHeader : string | undefined = req.headers['x-signature']?.toString() 

    if (lemonHeader === undefined) {
        res.status(400).send()
        return;
    }

    let event = JSON.parse(req.body);

    try {

        const crypto    = require('crypto');
        const hmac      = crypto.createHmac('sha256', process.env.LEMON_WEBHOOK_SECRET!);
        const digest    = Buffer.from(hmac.update(req.body).digest('hex'), 'utf8');
        const signature = Buffer.from(req.get('X-Signature') || '', 'utf8');
        
        if (!crypto.timingSafeEqual(digest, signature)) {
            throw new Error('Invalid signature.');
        }
    }
    catch (err: any) {
        if (process.env.DEVELOPMENT)
        {
            console.log("Failed to verify signature for callback")
        }
        res.status(500).send("Getting invalid error type when trying to verify signature")
        return
    }

    if (process.env.DEVELOPMENT) {

      console.log(event)
    }

    switch (event.meta.event_name) {
        case 'subscription_created':
            {
                const subData : any = event.data.attributes
                const custom_data : {uid: string} = event.meta.custom_data;
        
                if (!custom_data.uid)
                {
                    res.status(400).send("Missing uid")
                
                    return 
                }

                const account = await getCollection("accounts").findOne({uid: custom_data.uid})
                assert(account)

                const customerId = await getCustomerIdFromUser(custom_data.uid)
                if (!customerId)
                {
                   await getCollection("subscribers").insertOne( { uid: custom_data.uid, customerId: subData.customer_id } )
                }

                const periodEnd : number = moment.utc(subData.renews_at).valueOf()

                const subId = subData.first_subscription_item.subscription_id

                getCollection("subscribers").updateOne({ customerId : subData.customer_id }, { $set: { subscriptionId:subId, periodEnd } })
                getCollection("users").updateOne({ uid: custom_data.uid, _id: custom_data.uid }, { $set: { plus: true } })

                break;
            }
        case 'subscription_updated':
            {
                const subData : any = event.data.attributes

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                // Subscription is cancelled or paused, revoke perks
                if (subData.status === "active" || subData.status === "trialing")
                {
                    const scheduledToPause = subData.scheduled_change?.action === "pause"

                    // Update cancel state
                    getCollection('subscribers').updateOne({ customerId, uid: subscriber.uid }, { $set: { paused: scheduledToPause } })

                    assert(subData.renews_at)

                    // Update period start and end
                    const periodEnd : number = moment.utc(subData.renews_at).valueOf()

                    getCollection('subscribers').updateOne({ customerId, uid: subscriber.uid }, { $set: { periodEnd } })
                }

                break;
            }
        case 'subscription_paused': 
            {
                const subData : any = event.data.attributes

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { paused: true, } })
                getCollection("users").updateOne({ uid: subscriber.uid, _id:subscriber }, { $set: { plus: false } })
                break;
            }   
        case 'subscription_resumed': 
            {
                const subData : any = event.data.attributes

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { canceled: false, } })
                break;
            }   
        case 'subscription_cancelled': 
            {
                const subData : any = event.data.attributes

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { canceled: true, } })
                break;
            }   
        case 'subscription_expired': 
            {
                const subData : any = event.data.attributes

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { subscriptionId: null, periodEnd: null, canceled: null, } })
                getCollection("users").updateOne({ uid: subscriber.uid, _id: subscriber.uid }, { $set: { plus: false } })
                break;
            }   
    }

    res.status(200).send()
};
