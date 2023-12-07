import Stripe from "stripe";
import e, { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_createdSubscription, mailTemplate_failedPaymentCancelSubscription } from "../../../modules/mail/mailTemplates";
import { logger } from "../../../modules/logger";
import assert from "node:assert";

export const stripeCallback = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled")
        return
    }

    const sig = req.headers['stripe-signature']

    if (sig === undefined) {
        res.status(400)
        return;
    }

    let event;

    try {
        event = getStripe()!.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    }
    catch (err: any) {
        if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
            console.log(err)
            res.status(400).send(`Webhook Error: ${err.message}`)
            return
        }
        res.status(500).send("Getting invalid error type when trying to verify signature")
        return
    }

    if (process.env.DEVELOPMENT) {
        console.log(event.type)
        console.log(event.data.object)
    }

    switch (event.type) {
        case 'customer.subscription.created':
            {
                if (event.data.object as Stripe.Subscription) {
                    const eventObject = event.data.object as Stripe.Subscription
                    if (process.env.DEVELOPMENT) {
                        console.log("sub")
                        console.log(eventObject)
                    }

                    const customerId = eventObject.customer

                    let subItem: Stripe.SubscriptionItem | undefined = undefined

                    if (eventObject.items.data.length == 1) {
                        subItem = eventObject.items.data[0]
                    }
                    else {
                        res.status(500).send("Unable to find subscription item in subscription")
                        return
                    }
                    if (process.env.DEVELOPMENT) {
                        console.log("subItem")
                        console.log(subItem)
                    }

                    const subscriber = await getCollection('subscribers').findOne({ customerId })
                    assert(subscriber)

                    getCollection("users").updateOne({ uid: subscriber.uid, _id: subscriber.uid }, { $set: { plus: true } })
                    sendSimpleEmail(subscriber.uid, mailTemplate_createdSubscription(), "Your Simply Plus subscription")

                    getCollection("subscribers").updateOne({ customerId }, { $set: { subscriptionId: eventObject.id, periodEnd: eventObject.current_period_end } })
                }
                break;
            }
        case 'customer.subscription.updated':
            {
                if (event.data.object as Stripe.Subscription) {
                    const eventObject = event.data.object as Stripe.Subscription

                    if (process.env.DEVELOPMENT) {
                        console.log("sub updated")
                        console.log(eventObject)
                    }

                    const customerId = eventObject.customer

                    const priceId = eventObject.items.data[0].price.id
                    getCollection('subscribers').updateOne({ customerId }, { $set: { priceId } })

                    if (eventObject.cancel_at_period_end !== undefined) {
                        getCollection('subscribers').updateOne({ customerId }, { $set: { cancelled: eventObject.cancel_at_period_end } })
                    }

                    if (eventObject.items.data.length == 1) {
                        const item = eventObject.items.data[0]
                        getCollection('subscribers').updateOne({ customerId }, { $set: { priceId: item.id } })
                    }
                }
                break;
            }

        case 'customer.subscription.deleted':
            {
                if (event.data.object as Stripe.Subscription) {
                    const eventObject = event.data.object as Stripe.Subscription

                    if (process.env.DEVELOPMENT) {
                        console.log("sub deleted")
                        console.log(eventObject)
                    }

                    const customerId = eventObject.customer

                    const subscriber = await getCollection('subscribers').findOne({ customerId })
                    assert(subscriber)

                    getCollection("subscribers").updateOne({ customerId }, { $unset: { subscriptionId: "", cancelled: "" } }, { upsert: true })
                    getCollection("users").updateOne({ uid: subscriber.uid }, { $set: { plus: false } })

                    if (eventObject.cancellation_details?.reason === "payment_failed") {
                        sendSimpleEmail(subscriber.uid, mailTemplate_failedPaymentCancelSubscription(), "Your Simply Plus subscription payment failed")
                    }
                }
                break;
            }
    }

    res.status(200).send()
};
