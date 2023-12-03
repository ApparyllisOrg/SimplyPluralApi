import { Request, Response } from "express";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail";
import { validateSchema } from "../../../util/validation";
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription } from "../../../modules/mail/mailTemplates";
import { nameToPriceId } from "./subscriptions.utils";
import assert from "node:assert";
import accounting from "accounting"
import getSymbolFromCurrency from "currency-symbol-map";

export const changeSubscription = async (req: Request, res: Response) => {
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

        const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, {
            items: [
                {
                    id: existingSubscription.items.data[0].id,
                    price: nameToPriceId(req.body.price)
                }
            ]
        })

        assert(result?.items.data[0].price.id == nameToPriceId(req.body.price))
        res.status(200).send("Changed subscription")

        let emailTemplate = await getTemplate(mailTemplate_changedSubscription())

        const priceValue = result?.items.data[0].price.unit_amount! * .01
        const currency = result.currency
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
