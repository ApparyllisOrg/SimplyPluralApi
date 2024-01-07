import { Request, Response } from "express";
import { isPaddleSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription, mailTemplate_refundedSubscription } from "../../../modules/mail/mailTemplates";
import { nameToPriceId, reportPaddleError } from "./subscriptions.utils";
import assert from "node:assert";
import accounting from "accounting"
import getSymbolFromCurrency from "currency-symbol-map";
import moment from "moment";
import { getRequestPaddle, postRequestPaddle } from "./subscriptions.http";
import { PaddleSubscriptionData } from "../../../util/paddle/paddle_types";

export const refundSubscription = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (!subscriber.subscriptionId) {
            res.status(404).send()
            return
        }

        const existingSubscription = await getRequestPaddle(`subscriptions/${subscriber.subscriptionId}`)
        if (!existingSubscription.success)
        {
            res.status(500).send()
            return
        }

        const existingSubData : PaddleSubscriptionData = existingSubscription.data

        if (existingSubData.status !== "active")
        {
            res.status(400).send("Cannot refund an inactive subscription")
            return
        }

        const dayInSeconds = 1000 * 60 * 60

        const now = Date.now() / 1000
        const subscriptionStart = subscriber.periodStart
        const periodStart = subscriber.periodEnd

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

        const resumeResult = await postRequestPaddle(`subscriptions/${subscriber.subscriptionId}/cancel`, { effective_from: 'immediately' })
        if (resumeResult.status !== 200)
        {
            reportPaddleError(subscriber.uid, "Request cancel sub to paddle")
            res.status(500).send("Something went wrong trying to refund your subscription")
            return 
        }
        
        const resumeData : PaddleSubscriptionData = resumeResult.data
        if (resumeData.status !== "canceled")
        {
            reportPaddleError(subscriber.uid, "Post request cancel sub to paddle")
            res.status(500).send("Something went wrong trying to refund your subscription")
            return
        }
        
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
