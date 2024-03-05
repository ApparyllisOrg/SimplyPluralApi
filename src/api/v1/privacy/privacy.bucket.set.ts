import { Request, Response } from "express";
import { validateSchema } from "../../../util/validation";
import assert from "assert";
import { getCollection, parseId } from "../../../modules/mongo";

export const transformBucketListToBucketIds = async (uid: string, bucketList: string[]) => {
    let mongoBucketIds : any[] = []
    bucketList.forEach((bucket : string) => 
    {
        mongoBucketIds.push(parseId(bucket))
    })

    const foundBuckets = await getCollection("privacyBuckets").find({ uid: uid, _id: { $in: mongoBucketIds }}).toArray()
    
   return mongoBucketIds.filter((bucketId) => foundBuckets.indexOf((bucket : any) => bucket._id === bucketId) >= 0)
}

export const setPrivacyBucket = async (req: Request, res: Response) => 
{
    assert(req.body.type === "members" 
        || req.body.type === "groups"
        || req.body.type === "customFronts"
        || req.body.type === "customFields" )

    const mongoBucketIds = await transformBucketListToBucketIds(res.locals.uid, req.body.buckets)

    const result = await getCollection(req.body.type).updateOne({ uid: res.locals.uid, _id : parseId(req.body.id) }, { $set: { buckets: mongoBucketIds } })
    if (result.modifiedCount > 0)
    { 
        res.status(200).send()
    }
    else 
    {
        res.status(404).send()
    }
}

export const validateSetPrivacyBucketSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			id: { type: "string", pattern: "^[A-Za-z0-9]{0,100}$" },
            buckets: {  type: "array", uniqueItems: true,  items: 
                { 
                    type: "string", format: "^[A-Za-z0-9]{0,100}$" 
                },
            },
			type: { type: "string", enum : ["members", "groups", "customFronts", "customFields"] },
		},
		nullable: false,
		additionalProperties: false,
		required: ["id", "type"],
	};

	return validateSchema(schema, body);
}