import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { ajv, validateSchema } from "../../../util/validation";
import { isLemonSetup } from "./subscriptions.core";
import { getLemonStoreRelationship, nameToPriceId, reportLemonError } from "./subscriptions.utils";
import { postRequestLemon } from "./subscriptions.http";

export const startCheckoutSession = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    if (process.env.LEMON_MAX_SUBS) {
        const maxSubs: number = parseInt(process.env.LEMON_MAX_SUBS);
        if (maxSubs && maxSubs > 0) {
            const numSubs: number = await getCollection("subscribers").countDocuments({ subscriptionId: { $ne: null } })
            if (numSubs >= maxSubs) {
                // 401 isn't correct.. what else can we use?
                res.status(401).send("Simply Plus is currently limiting the amount of subscribers. The limit has been reached, try again when Simply Plus if fully released.");
                return;
            }
        }
    }

    const priceId : string = nameToPriceId(req.body.price)

    const result = await postRequestLemon(`v1/checkouts`, {
        data: {
            type: "checkouts",
            attributes: {
                checkout_data: {
                    custom: {
                        "uid": res.locals.uid
                    }
                },
                checkout_options:
                {
                    embed: true,
                    dark: true
                }
            },
            relationships: {
                store: getLemonStoreRelationship(),
                variant: {
                    data: {
                    type: "variants",
                    id: priceId
                    }
                }
            } 
        }
    })
    if (result.status !== 201)
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(result)
        }
        reportLemonError(res.locals.uid, "Creating a checkout")
        res.status(500).send("Something went wrong trying to start a checkout session")
        return
    }

    const checkoutUrl = result.data.data.attributes.url
    res.status(200).send({checkoutUrl})
};

const s_validateCheckoutSessionSchema = {
    type: "object",
    properties: {
        price: {
            type: "string",
            pattern: "^(affordable|regular|pif)$"
        }
    },
    nullable: false,
    additionalProperties: false,
    required: ["price"],
};
const v_validateCheckoutSessionSchema = ajv.compile(s_validateCheckoutSessionSchema)

export const validateCheckoutSessionSchema = (body: unknown): { success: boolean; msg: string } => {
    return validateSchema(v_validateCheckoutSessionSchema, body);
};

