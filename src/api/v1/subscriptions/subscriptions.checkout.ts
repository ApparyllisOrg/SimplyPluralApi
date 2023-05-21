import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getStripe } from "./subscriptions.core";

export const generateSubscribeSession = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    let price = "";

    const requestedPrice = req.body.price;
    switch (requestedPrice) {
        case "affordable": {
            price = process.env.STRIPE_PRICE_A!;
            break;
        }
        case "regular": {
            price = process.env.STRIPE_PRICE_B!;
            break;
        }
        case "pif": {
            price = process.env.STRIPE_PRICE_C!;
            break;
        }
    }

    const session = await getStripe()!.checkout.sessions.create(
        {
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
        res.status(200).send({ url: session.url, id: session.id });
    }
    else {
        res.status(500).send("Something went wrong trying to create checkout session");
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
