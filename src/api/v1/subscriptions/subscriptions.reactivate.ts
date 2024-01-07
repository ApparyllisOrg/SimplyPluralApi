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
            res.status(200).send("Subscription already active")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(200).send("Subscription not existing")
            return
        }

        const existingSubscription = await getRequestPaddle(`subscriptions/${subscriber.subscriptionId}`)

        assert(existingSubscription.success === true)

        const existingSubData : PaddleSubscriptionData = existingSubscription.data
        assert(existingSubData.scheduled_change?.action === "pause")

        const resumeResult = await postRequestPaddle(`subscriptions/${subscriber.subscriptionId}/resume`, { effective_from: 'next_billing_period' })
        if (resumeResult.status !== 200)
        {
            reportPaddleError(subscriber.uid, "Request resume to paddle")
            res.status(500).send("Something went wrong trying to reactivate your subscription")
            return 
        }

        res.status(200).send("Reactivated subscription")
        sendSimpleEmail(res.locals.uid, mailTemplate_reactivatedSubscription(), "Your Simply Plus subscription is reactivated")
    }
    else {
        res.status(404).send()
    }
};
