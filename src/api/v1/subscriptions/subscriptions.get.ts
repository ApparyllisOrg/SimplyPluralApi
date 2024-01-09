
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { isPaddleSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { transformResultForClientRead } from "../../../util";
import { client_result } from "../../../util/types";
import { priceIdToName } from "./subscriptions.utils";
import { getRequestPaddle } from "./subscriptions.http";
import { PaddleSubscription, PaddleSubscriptionData } from "../../../util/paddle/paddle_types";

type subscription_client_result = client_result<{ price: number, currency: string, periodEnd: number, periodStart: number, priceId: string, paused: boolean, customerId : string, subscribed: boolean }>

export const getSubscription = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber && subscriber.subscriptionId) {
        
        const existingSubscription = await getRequestPaddle(`subscriptions/${subscriber.subscriptionId}`)

        
        assert(existingSubscription.success === true)

        const existingSubData : PaddleSubscriptionData = existingSubscription.data.data
     
        assert(existingSubData.items.length == 1)
        const item = existingSubData.items[0]

        const response: subscription_client_result =
        {
            id: existingSubData.id,
            exists: true,
            content: {
                price: Number(item.price.unit_price.amount) ?? 0 ,
                currency: item.price.unit_price.currency_code,
                periodEnd: subscriber.periodEnd,
                periodStart: subscriber.periodStart,
                priceId: priceIdToName(existingSubData.items[0].price.id),
                paused: existingSubData.scheduled_change?.action === "pause" || existingSubData.status === "paused",
                customerId: subscriber.customerId,
                subscribed: !!subscriber.subscriptionId
            }
        }
        res.status(200).send(response)
        return

    }
    else if (subscriber)
    {
        const response: subscription_client_result =
        {
            id: "",
            exists: false,
            content: {
                price: 0,
                currency: '',
                periodEnd: 0,
                periodStart: 0,
                priceId: '',
                paused: false,
                customerId: subscriber.customerId,
                subscribed: false
            }
        }
        res.status(200).send(response)
        return;
    }

    const response: subscription_client_result =
        {
            id: "",
            exists: false,
            content: {
                price: 0,
                currency: '',
                periodEnd: 0,
                periodStart: 0,
                priceId: '',
                paused: false,
                customerId: '',
                subscribed: false
            }
        }
    res.status(200).send(response)
};
