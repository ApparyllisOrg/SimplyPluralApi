import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { validateSchema } from "../../../util/validation";
import { isLemonSetup } from "./subscriptions.core";
import { deleteRequestLemon, } from "./subscriptions.http";
import { reportLemonError } from "./subscriptions.utils";
import assert from "assert";

export const cancelSubscription = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber) {
        if (subscriber.canceled === true) {
            res.status(200).send("Subscription already canceled")
            return
        }

        if (!subscriber.subscriptionId) {
            res.status(200).send("Subscription not active")
            return
        }

        const existingSubscription = await deleteRequestLemon(`v1/subscriptions/${subscriber.subscriptionId}`)

        if (existingSubscription.status !== 200)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(existingSubscription)
            }
            reportLemonError(subscriber.uid, "Request pausing subcription to lemon")
            res.status(500).send("Something went wrong trying to cancel your subscription")
            return
        }

        assert(existingSubscription.status === 200)

        const requestData : any = existingSubscription.data
        const subData = requestData.data
        const subAttributes = subData.attributes

        assert(subAttributes.cancelled === true)
        assert(subAttributes.status === "cancelled")

        await getCollection("cancelFeedback").insertOne({feedback: req.body.feedback, reason: req.body.reason, date: new Date().toISOString()})
        res.status(200).send("Cancelled subscription")
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
