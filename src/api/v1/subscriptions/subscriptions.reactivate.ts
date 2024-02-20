import { Request, Response } from "express";
import { isLemonSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_reactivatedSubscription } from "../../../modules/mail/mailTemplates";
import { getRequestLemon, patchRequestLemon, postRequestLemon } from "./subscriptions.http";
import assert from "assert";

import { reportLemonError } from "./subscriptions.utils";


export const reactivateSubscription = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (subscriber.canceled !== true) {
            res.status(400).send("Subscription already active")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(400).send("Subscription not existing")
            return
        }

        const existingSubscription = await getRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}`)

        assert(existingSubscription.success === true)

        const existingSubData : any = existingSubscription.data.data
        const existingSubAttributes = existingSubData.attributes

        if (existingSubAttributes.status !== "cancelled")
        {
            res.status(400).send("Subscription is not cancelled, cannot reacticate")
            return
        }

        const reactivateResult = await patchRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}`, {
            data: 
            {
                id: subscriber.subscriptionId.toString(),
                type: "subscriptions",
                attributes: {
                    cancelled: false,
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

        res.status(200).send("Reactivated subscription")
    }
    else {
        res.status(404).send()
    }
};
