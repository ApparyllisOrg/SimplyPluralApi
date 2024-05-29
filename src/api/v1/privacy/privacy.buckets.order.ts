import { Request, Response } from "express";
import { getCollection, parseId } from "../../../modules/mongo";
import { validateSchema } from "../../../util/validation";

export const orderBuckets = async (req: Request, res: Response) => {
    const buckets : {id: string, rank: string}[] = req.body.buckets
   
    for (let i = 0; i < buckets.length; ++i)
    {
        getCollection("privacyBuckets").updateOne({ uid: res.locals.uid, _id: parseId(buckets[i].id) }, { $set: { rank: buckets[i].rank }});
    }

	res.status(200).send()
};

export const validateOrderBucketsSchema = (body: unknown): { success: boolean; msg: string } => {
    const schema = {
        type: "object", 
        properties: {
            buckets: { type: "array",  items: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
                    rank: { type: "string", pattern: "^0\|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
                },
                required: ["id", "rank",],
                nullable: false,
                additionalProperties: false,
            }}
        },
        required: ["buckets",],
        nullable: false,
        additionalProperties: false,
    }

	return validateSchema(schema, body);
};