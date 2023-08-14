import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_reactivatedSubscription } from "../../../modules/mail/mailTemplates";

export const reactivateSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber !== undefined) {
        const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, { cancel_at_period_end: false })
        if (result?.cancel_at_period_end === false) {
            res.status(200).send("Reactivated subscription")
            sendSimpleEmail(res.locals.uid, mailTemplate_reactivatedSubscription(), "Your Simply Plus subscription is reactivated")
        }
        else {
            res.status(500).send("Unable to reactivate subscription")
        }
    }
    else {
        res.status(404).send()
    }
};
