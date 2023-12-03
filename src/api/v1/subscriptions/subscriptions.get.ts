import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { transformResultForClientRead } from "../../../util";
import { client_result } from "../../../util/types";
import { priceIdToName } from "./subscriptions.utils";

export const getSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber && subscriber.subscriptionId) {
        const subscription = await getStripe()?.subscriptions.retrieve(subscriber.subscriptionId)
        if (subscription) {

            assert(subscription.items.data.length == 1)
            const item = subscription.items.data[0]

            const response: client_result<{ price: number, currency: string, periodEnd: number, periodStart: number, subscriptionStart: number, priceId: string, cancelled: boolean }> =
            {
                id: subscription.id,
                exists: true,
                content: {
                    price: item.price.unit_amount ?? 0,
                    currency: item.price.currency,
                    periodEnd: subscription.current_period_end,
                    periodStart: subscription.current_period_start,
                    subscriptionStart: subscription.start_date,
                    priceId: priceIdToName(item.price.id),
                    cancelled: subscription.canceled_at ? true : false
                }
            }
            res.status(200).send(response)
            return
        }
    }
    res.status(404).send()
};
