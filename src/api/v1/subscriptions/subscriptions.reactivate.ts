import { Request, Response } from "express";
import { isPaddleSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_reactivatedSubscription } from "../../../modules/mail/mailTemplates";
import { getRequestPaddle, postRequestPaddle } from "./subscriptions.http";
import { PaddleSubscriptionData } from "../../../util/paddle/paddle_types";
import assert from "assert";

import { reportPaddleError } from "./subscriptions.utils";


export const reactivateSubscription = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (subscriber.paused !== true) {
            res.status(400).send("Subscription already active")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(400).send("Subscription not existing")
            return
        }

        const existingSubscription = await getRequestPaddle(`subscriptions/${subscriber.subscriptionId}`)

        assert(existingSubscription.success === true)

        const existingSubData : PaddleSubscriptionData = existingSubscription.data.data

        let effective_from

        if (existingSubData.status === "active")
        {
            effective_from = 'next_billing_period';
        }
        else if (existingSubData.scheduled_change?.action === "pause")
        {
            effective_from = 'next_billing_period';
        }
        else if (existingSubData.status === "paused")
        {
            effective_from = 'immediately';
        }

        if (!effective_from)
        {
            res.status(500).send("Something went wrong, we're unable to resume the subscription, please contact support.")
            return
        }

        console.log(existingSubData)

        const resumeResult = await postRequestPaddle(`subscriptions/${subscriber.subscriptionId}/resume`, { effective_from: effective_from })
        if (resumeResult.status !== 200)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(resumeResult)
            }

            reportPaddleError(subscriber.uid, "Request resume to paddle")
            res.status(500).send("Something went wrong trying to reactivate your subscription")
            return 
        }

        res.status(200).send("Reactivated subscription")
    }
    else {
        res.status(404).send()
    }
};
