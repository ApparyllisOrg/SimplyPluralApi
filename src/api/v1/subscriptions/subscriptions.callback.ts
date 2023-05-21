import Stripe from "stripe";
import e, { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";

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
                    if (subscriber !== undefined) {
                        getCollection("users").updateOne({ uid: subscriber.uid, _id: subscriber.uid }, { $set: { plus: true } })

                        const price = subItem.plan.amount
                        const periodEnd = eventObject.current_period_end
                        const currency = subItem.plan.currency

                        getCollection("subscribers").updateOne({ customerId }, { $set: { price, periodEnd, currency } }, { upsert: true })

                        sendSimpleEmail(subscriber.uid, "./templates/subscription/createdSubscription.html", "Your Simply Plus subscription")
                    }
                    else {
                        res.status(500).send("Unable to find customer in our database in subscription")
                        return
                    }
                }
                break;
            }

        case 'checkout.session.completed':
            {
                if (event.data.object as Stripe.Checkout.Session) {
                    const eventObject = event.data.object as Stripe.Checkout.Session

                    if (process.env.DEVELOPMENT) {
                        console.log("session")
                        console.log(eventObject)
                    }

                    const subscriptionId = eventObject.subscription
                    const customerId = eventObject.customer

                    getCollection('subscribers').updateOne({ customerId }, { $set: { uid: eventObject.client_reference_id, subscriptionId } }, { upsert: true })
                }
                break;
            }

        case 'invoice.paid':
            {
                if (event.data.object as Stripe.Invoice) {
                    const eventObject = event.data.object as Stripe.Invoice

                    if (process.env.DEVELOPMENT) {
                        console.log("invoice")
                        console.log(eventObject)
                    }
                    const customerId = eventObject.customer

                    const subscriber = await getCollection('subscribers').findOne({ customerId })
                    if (subscriber !== undefined) {
                        getCollection("invoices").insertOne({
                            uid: subscriber.uid,
                            customerId,
                            invoiceId: eventObject.id,
                            currency: eventObject.currency,
                            price: eventObject.amount_paid,
                            url: eventObject.hosted_invoice_url,
                            time: eventObject.created,
                            subscriptionId: eventObject.subscription
                        })
                    }
                    else {
                        res.status(404).send("Unable to find customer in our database in subscription")
                        return
                    }
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
                    if (eventObject.cancel_at_period_end !== undefined) {
                        getCollection('subscribers').updateOne({ customerId }, { $set: { cancelled: eventObject.cancel_at_period_end } })
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
                    if (subscriber !== undefined) {
                        getCollection("users").updateOne({ uid: subscriber.uid }, { $set: { plus: false } })
                    }

                    getCollection('subscribers').deleteOne({ customerId })
                }
                break;
            }
    }

    res.status(200).send()
};
