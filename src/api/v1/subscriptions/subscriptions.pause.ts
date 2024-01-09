import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { sendSimpleEmail } from "../../../modules/mail";
import { mailTemplate_cancelledSubscription } from "../../../modules/mail/mailTemplates";
import { validateSchema } from "../../../util/validation";
import { isPaddleSetup } from "./subscriptions.core";
import { postRequestPaddle } from "./subscriptions.http";
import { PaddleSubscriptionData } from "../../../util/paddle/paddle_types";
import { reportPaddleError } from "./subscriptions.utils";

export const pauseSubscription = async (req: Request, res: Response) => {
    if (!isPaddleSetup()) {
        res.status(404).send("API is not Paddle enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (subscriber.paused === true) {
            res.status(200).send("Subscription already paused")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(200).send("Subscription not active")
            return
        }

        const result = await postRequestPaddle(`subscriptions/${subscriber.subscriptionId}/pause`, {effective_from: "next_billing_period"})
        if (result.status !== 200)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(result)
            }
            reportPaddleError(subscriber.uid, "Request pausing subcription to paddle")
            res.status(500).send("Something went wrong trying to pause your subscription")
            return
        }

        const resultData : PaddleSubscriptionData = result.data.data
        if (resultData.scheduled_change?.action === "pause") {
            await getCollection("cancelFeedback").insertOne({feedback: req.body.feedback, reason: req.body.reason, date: new Date().toISOString()})
            res.status(200).send("Paused subscription")
        }
        else {
            res.status(500).send("Unable to pause subscription")
        }
    }
    else {
        res.status(404).send()
    }
};

export const validatePauseSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
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
