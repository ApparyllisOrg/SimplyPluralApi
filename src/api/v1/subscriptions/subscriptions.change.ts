import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { mailTemplate_cancelledSubscription, mailTemplate_changedSubscription } from "../../../modules/mail/mailTemplates";

export const changeSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber !== undefined) {
        const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, { cancel_at_period_end: true })
        if (result?.cancel_at_period_end !== undefined) {

            res.status(200).send("Change subscription")

            sendSimpleEmail(res.locals.uid, mailTemplate_changedSubscription(), "Your Simply Plus subscription has changed")
        }
        else {
            res.status(500).send("Unable to cancel subscription")
        }
    }
    else {
        res.status(404).send()
    }
};

export const validateChangeSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
    const schema = {
        type: "object",
        properties: {
            price: {
                type: "string",
                pattern: "^(affordable|regular|pif)$"
            },
        },
        nullable: false,
        additionalProperties: false,
        required: ["price"],
    };

    return validateSchema(schema, body);
};
