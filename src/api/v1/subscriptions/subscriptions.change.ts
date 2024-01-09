import { Request, Response } from "express";
import {isPaddleSetup } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription } from "../../../modules/mail/mailTemplates";
import { nameToPriceId, reportPaddleError } from "./subscriptions.utils";
import assert from "node:assert";
import accounting from "accounting"
import getSymbolFromCurrency from "currency-symbol-map";
import { getRequestPaddle, patchRequestPaddle, postRequestPaddle } from "./subscriptions.http";
import { PaddleSubscription } from "../../../util/paddle/paddle_types";

export const changeSubscription = async (req: Request, res: Response) => {
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

        assert(existingSubscription.success === true)

        const existingSubData : PaddleSubscription = existingSubscription.data

        assert(existingSubData.data.items.length === 1)
        assert(existingSubData.data.items[0].price)

        const priceId = nameToPriceId(req.body.price) 

        if (priceId === existingSubData.data.items[0].price.id)
        {
            res.status(200).send("Subscription already at this price")
            return;
        }

        const updatedSubscription = await patchRequestPaddle(`subscriptions/${subscriber.subscriptionId}`, {items: [
            {price_id: priceId, quantity: 1}
        ], proration_billing_mode: "full_next_billing_period"})
        if (updatedSubscription.status !== 200)
        {
            if (process.env.DEVELOPMENT)
            {
                console.log(updatedSubscription)
            }
            reportPaddleError(subscriber.uid, "Request change subscription price to paddle")
            res.status(500).send("Something went wrong trying to update your subscription")
            return
        }

        const updatedSubData : PaddleSubscription = updatedSubscription.data

        assert(updatedSubData.data.items[0].price.id === priceId)

        res.status(200).send("Changed subscription")

        let emailTemplate = await getTemplate(mailTemplate_changedSubscription())

        const priceValue = Number(updatedSubData.data.items[0].price.unit_price.amount) * .01
        const currency = updatedSubData.data.items[0].price.unit_price.currency_code
        
        emailTemplate = emailTemplate.replace("{{newPrice}}", `${accounting.formatMoney(priceValue, getSymbolFromCurrency(currency), 2)}`);

        sendCustomizedEmail(res.locals.uid, emailTemplate, "Your Simply Plus subscription has changed");
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
