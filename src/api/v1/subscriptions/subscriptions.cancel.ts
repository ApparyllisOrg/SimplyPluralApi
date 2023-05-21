import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";

export const cancelSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber !== undefined) {
        const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, { cancel_at_period_end: true })
        if (result?.cancel_at_period_end !== undefined) {
            res.status(200).send("Cancelled subscription")

            sendSimpleEmail(res.locals.uid, "./templates/subscription/cancelledSubscription.html", "Your Simply Plus subscription is cancelled")
        }
        else {
            res.status(500).send("Unable to cancel subscription")
        }
    }
    else {
        res.status(404).send()
    }
};
