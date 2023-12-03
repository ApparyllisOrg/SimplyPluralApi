import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_cancelledSubscription } from "../../../modules/mail/mailTemplates";
import { validateSchema } from "../../../util/validation";

export const cancelSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (subscriber.cancelled === true) {
            res.status(200).send("Subscription already cancelled")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(200).send("Subscription not active")
            return
        }

        const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, { cancel_at_period_end: true, cancellation_details: { feedback: req.body.feedback, comment: req.body.comment }, })
        if (result?.cancel_at_period_end !== undefined) {
            res.status(200).send("Cancelled subscription")

            sendSimpleEmail(res.locals.uid, mailTemplate_cancelledSubscription(), "Your Simply Plus subscription is cancelled")
        }
        else {
            res.status(500).send("Unable to cancel subscription")
        }
    }
    else {
        res.status(404).send()
    }
};

export const validateCancelSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
    const schema = {
        type: "object",
        properties: {
            reason: { type: "string", maxLength: 400 },
            feedback: {
                type: "string",
                pattern: "^(too_expensive|missing_features|too_complex|low_quality|other)$"
            },
        },
        nullable: false,
        additionalProperties: false,
        required: ["feedback"],
    };

    return validateSchema(schema, body);
};
