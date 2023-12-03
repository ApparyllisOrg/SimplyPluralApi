import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription, mailTemplate_refundedSubscription } from "../../../modules/mail/mailTemplates";
import { nameToPriceId } from "./subscriptions.utils";
import assert from "node:assert";
import accounting from "accounting"
import getSymbolFromCurrency from "currency-symbol-map";
import moment from "moment";

export const refundSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (!subscriber.subscriptionId) {
            res.status(404).send()
            return
        }

        const existingSubscription = await getStripe()?.subscriptions.retrieve(subscriber.subscriptionId)
        assert(existingSubscription)

        const dayInSeconds = 1000 * 60 * 60

        const now = Date.now() / 1000
        const subscriptionStart = existingSubscription.start_date
        const periodStart = existingSubscription.current_period_start

        let allowRefund = false

        const daysSinceSubStart = (now - subscriptionStart) / dayInSeconds
        const daysSincePeriodStart = (now - periodStart) / dayInSeconds

        if (daysSinceSubStart <= 7) {
            allowRefund = true;
        }
        else if (daysSincePeriodStart <= 7) {
            allowRefund = true;
        }

        if (!allowRefund) {
            res.status(403).send("You are currently not eligible for a refund.")
            return
        }

        const result = await getStripe()?.subscriptions.cancel(subscriber.subscriptionId, {
            cancellation_details: { feedback: req.body.feedback, comment: req.body.comment },
            prorate: true,

        })

        assert(result?.canceled_at != null)
        res.status(200).send("Refunded subscription")

        sendSimpleEmail(res.locals.uid, mailTemplate_refundedSubscription(), "Your Simply Plus subscription has been refunded")
    }
    else {
        res.status(404).send()
    }
};

export const validateRefundSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
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
