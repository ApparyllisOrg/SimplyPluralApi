import e from "cors";
import { Request, Response } from "express";
import Stripe from "stripe";
import { logger } from "../../../modules/logger";
import { getCollection } from "../../../modules/mongo";
import { validateSchema } from "../../../util/validation";
import { getCustomerIdFromUser, getStripe } from "./subscriptions.core";
import { nameToPriceId } from "./subscriptions.utils";

export const generateSubscribeSession = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    let price = nameToPriceId(req.body.price);
    let customer = await getCustomerIdFromUser(res.locals.uid, true)

    if (customer) {
        const session = await getStripe()!.checkout.sessions.create(
            {
                customer: customer.id,
                line_items: [
                    {
                        price: price,
                        quantity: 1
                    }
                ],
                mode: "subscription",
                success_url: `${process.env.PLUS_ROOT_URL!}#success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.PLUS_ROOT_URL!}#dashboard`,
                client_reference_id: res.locals.uid,
                payment_method_types: ["sepa_debit", "card", "paypal", "sofort"],
                phone_number_collection: { enabled: false },
                metadata: {
                    uid: res.locals.uid
                }
            }
        ).catch((e) => {
            if (process.env.DEVELOPMENT) {
                console.log(e)
            }
        })

        if (session !== undefined) {
            logger.info(JSON.stringify(session))
            res.status(200).send({ url: session.url, id: session.id });
        }
        else {
            res.status(500).send("Something went wrong trying to create checkout session");
        }
    }
    else {
        res.status(500).send("Unable to find or create a new customer");
    }

};

export const validateSubscribeSessionsSchema = (body: unknown): { success: boolean; msg: string } => {
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
