
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

export const getSubscription = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber && subscriber.subscriptionId) {
        
        const existingSubscription = await getRequestPaddle(`subscriptions/${subscriber.subscriptionId}`)

        assert(existingSubscription.success === true)

        const existingSubData : PaddleSubscriptionData = existingSubscription.data
     
        assert(existingSubData.items.length == 1)
        const item = existingSubData.items[0]

        const response: client_result<{ price: number, currency: string, periodEnd: number, periodStart: number, priceId: string, cancelled: boolean }> =
        {
            id: existingSubData.id,
            exists: true,
            content: {
                price: Number(item.price.unit_price.amount) ?? 0 ,
                currency: item.price.unit_price.currency_code,
                periodEnd: subscriber.periodEnd,
                periodStart: subscriber.periodStart,
                priceId: priceIdToName(existingSubData.items[0].price.id),
                cancelled: existingSubData.canceled_at ? true : false
            }
        }
        res.status(200).send(response)
        return

    }
    res.status(404).send()
};
