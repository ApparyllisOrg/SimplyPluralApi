
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { isLemonSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { transformResultForClientRead } from "../../../util";
import { client_result } from "../../../util/types";
import { priceIdToName } from "./subscriptions.utils";
import { getRequestLemon } from "./subscriptions.http";
import moment from "moment";

type subscription_client_result = client_result<{ price: number, currency: string, periodEnd: number, priceId: string, canceled: boolean, customerId : string, subscribed: boolean, managePaymentMethods: string, trial: boolean }>

export const getSubscription = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber && subscriber.subscriptionId) {
        
        const existingSubscription = await getRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}?include=order`)

        if (existingSubscription.success !== true)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(existingSubscription)
            }
            res.status(500).send("Something went wrong trying to get your subscription")
            return
        }

        const existingSubData : any = existingSubscription.data.data
        const subAttributes = existingSubData.attributes

        const includeData = existingSubscription.data.included[0]
        const includeAttributes = includeData.attributes
        const includeFirstItem = includeAttributes.first_order_item

        const response: subscription_client_result =
        {
            id: existingSubData.id,
            exists: true,
            content: {
                price: Number(includeFirstItem.price) ?? 0 ,
                currency: includeAttributes.currency,
                periodEnd: new Date(subAttributes.renews_at).getTime() * .001, //Decrease a timestep
                priceId: subAttributes.variant_id.toString(),
                canceled: subAttributes.status === "cancelled",
                customerId: subscriber.customerId.toString(),
                subscribed: true,
                managePaymentMethods: subAttributes.urls.update_payment_method,
                trial: subAttributes.status === "on_trial"
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
                priceId: '',
                canceled: false,
                customerId: subscriber.customerId,
                subscribed: false,
                managePaymentMethods: '',
                trial: false
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
                priceId: '',
                canceled: false,
                customerId: '',
                subscribed: false,
                managePaymentMethods: '',
                trial: false
            }
        }
    res.status(200).send(response)
};
