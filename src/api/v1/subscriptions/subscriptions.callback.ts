import e, { Request, Response } from "express";
import { getCustomerIdFromUser, isPaddleSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_createdSubscription, mailTemplate_failedPaymentCancelSubscription } from "../../../modules/mail/mailTemplates";
import { logger } from "../../../modules/logger";
import assert from "node:assert";
import * as crypto from "crypto";
import moment from "moment";
import { PaddleSubscriptionData } from "../../../util/paddle/paddle_types";
import * as Sentry from "@sentry/node";
import { ERR_SUBSCRIPTION_POTENTIALLYMALICIOUS } from "../../../modules/errors";
import { postRequestPaddle } from "./subscriptions.http";

export const paddleCallback = async (req: Request, res: Response) => {
    
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled")
        return
    }

    const paddleHeader = req.headers['paddle-signature']?.toString()

    if (paddleHeader === undefined) {
        res.status(400).send()
        return;
    }

    let event = JSON.parse(req.body);

    try {
        const paddleHeaderParts = paddleHeader.split(";")
        const paddleTs = paddleHeaderParts[0]
        const paddleH1 = paddleHeaderParts[1]

        const paddleExtractedTs = paddleTs.split("=")[1]
        const extractedTs = Number(paddleExtractedTs)

        const paddleExtractedH1 = paddleH1.split("=")[1]

        const payload = `${extractedTs}:${req.body}`

        const hmac = crypto
        .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET!)
        .update(payload)

        if (!paddleExtractedH1.match(hmac.digest("hex")))
        {
            res.status(401).send("No")
            return
        }

    }
    catch (err: any) {
        res.status(500).send("Getting invalid error type when trying to verify signature")
        return
    }

    if (process.env.DEVELOPMENT) {

       console.log(event.event_type)
       console.log(event.data)
    }

    switch (event.event_type) {
        case 'subscription.created':
            {
                const subData : PaddleSubscriptionData = event.data

                const custom_data : {uid: string, ts: string, hmac: string, cancelReason: string | undefined} = subData.custom_data;

                const reportInvalid = (error: string, uid: string) => 
                {
                    Sentry.captureMessage(`ErrorCode(${ERR_SUBSCRIPTION_POTENTIALLYMALICIOUS})`, (scope) => {
                        scope.setExtra("reason", error);
                        scope.setExtra("uid", uid);
                        return scope;
                    });

                    const newCustomData = custom_data
                    newCustomData.cancelReason = error

                    postRequestPaddle(`subscriptions/${subData.id}`, { custom_data: newCustomData })
                    postRequestPaddle(`subscriptions/${subData.id}/cancel`, { effective_from: "immediately" })
                }

                if (!custom_data.uid)
                {
                    res.status(400).send("Missing uid")
                    reportInvalid("Missing uid", "")
                    return 
                }

                if (!custom_data.ts)
                {
                    res.status(400).send("Missing ts")
                    reportInvalid("Missing ts", custom_data.uid)
                    return 
                }

                if (!custom_data.hmac)
                {
                    res.status(400).send("Missing hmac")
                    reportInvalid("Missing hmac", custom_data.uid)
                    return 
                }

                if (subData.items.length !== 1)
                {
                    res.status(400).send("Invalid subscription data")
                    reportInvalid("Invalid item count", custom_data.uid)
                    return 
                }

                const uid = custom_data.uid
                const price = subData.items[0].price.id
                const ts = custom_data.ts

                const value = uid + price + ts
                const hmac = crypto.createHmac('sha256', process.env.PADDLE_HMAC_KEY!)
                hmac.update(value)

                const digest = hmac.digest('hex')

                if (custom_data.hmac !== digest)
                {
                    res.status(401).send("HMAC does not match the payload!")
                    reportInvalid("Invalid HMAC", uid)
                    return 
                }

                const account = await getCollection("accounts").findOne({uid: custom_data.uid})
                assert(account)

                const customerId = await getCustomerIdFromUser(custom_data.uid)
                assert(customerId)

                assert(subData.current_billing_period)

                sendSimpleEmail(custom_data.uid, mailTemplate_createdSubscription(), "Your Simply Plus subscription")

                const periodStart : number = moment.utc(subData.current_billing_period.starts_at).valueOf()
                const periodEnd : number = moment.utc(subData.next_billed_at).valueOf()

                getCollection("subscribers").updateOne({ customerId }, { $set: { subscriptionId: subData.id, periodEnd, periodStart } })
                getCollection("users").updateOne({ uid: custom_data.uid, _id: custom_data.uid }, { $set: { plus: true } })

                break;
            }
        case 'subscription.updated':
            {
                const subData : PaddleSubscriptionData = event.data

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                // Subscription is cancelled or paused, revoke perks
                if (subData.status === "active")
                {
                    const scheduledToPause = subData.scheduled_change?.action === "paused"

                    // Update cancel state
                    getCollection('subscribers').updateOne({ customerId, uid: subscriber.uid }, { $set: { cancelled: scheduledToPause } })

                    assert(subData.current_billing_period)

                    // Update period start and end
                    const periodStart : number = moment.utc(subData.current_billing_period.starts_at).valueOf()
                    const periodEnd : number = moment.utc(subData.current_billing_period.ends_at).valueOf()

                    getCollection('subscribers').updateOne({ customerId, uid: subscriber.uid }, { $set: { periodStart, periodEnd } })
                }

                break;
            }
        case 'subscription.paused': 
            {
                const subData : PaddleSubscriptionData = event.data

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { subscriptionId: null, periodEnd: null, cancelled: null, periodStart: null} })
                getCollection("users").updateOne({ uid: subscriber.uid, _id:subscriber }, { $set: { plus: false } })
            }   
        case 'subscription.canceled': 
            {
                const subData : PaddleSubscriptionData = event.data

                const customerId = subData.customer_id
                const subscriber = await getCollection("subscribers").findOne({customerId: customerId})
                assert(subscriber)

                getCollection("subscribers").updateOne({ customerId, uid: subscriber.uid }, { $set: { subscriptionId: null, periodEnd: null, cancelled: null, periodStart: null} })
                getCollection("users").updateOne({ uid: subscriber.uid, _id:subscriber }, { $set: { plus: false } })
            }   
    }

    res.status(200).send()
};
