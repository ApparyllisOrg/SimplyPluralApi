import { Request, Response } from "express";
import { validateSchema } from "../../../util/validation";
import assert from "assert";
import { getCollection, parseId } from "../../../modules/mongo";
import { convertListToIds } from "../../../util";
import { ObjectId } from "mongodb";

const setPrivacyBucketsRecursive = async (groupId: string, uid: string, buckets: (string|ObjectId)[]) => {
	const groups = await getCollection("groups").find({ uid, parent: groupId }).toArray();
	for (let i = 0; i < groups.length; i++) {
		await setPrivacyBucketsRecursive(groups[i]._id.toString(), uid, buckets);
	}

	await getCollection("groups").updateOne({ uid, _id: parseId(groupId) }, { $set: { buckets } });
};

export const setPrivacyBuckets = async (req: Request, res: Response) => 
{
    assert(req.body.type === "members" 
        || req.body.type === "groups"
        || req.body.type === "frontStatuses"
        || req.body.type === "customFields" )

    const mongoBucketIds = await convertListToIds(res.locals.uid, "privacyBuckets", req.body.buckets)

    const result = await getCollection(req.body.type).updateOne({ uid: res.locals.uid, _id : parseId(req.body.id) }, { $set: { buckets: mongoBucketIds } })
    if (result.modifiedCount > 0)
    { 
        if (req.body.type === "groups" && req.body.recursive === true)
        {
            setPrivacyBucketsRecursive(req.body.id, res.locals.uid, mongoBucketIds)
        }

        res.status(200).send()
    }
    else 
    {
        res.status(404).send()
    }
}

export const validateSetPrivacyBucketsSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			id: { type: "string", pattern: "^[A-Za-z0-9]{0,100}$" },
            buckets: {  type: "array", uniqueItems: true,  items: 
                { 
                    type: "string", pattern: "^[A-Za-z0-9]{0,100}$" 
                },
            },
            recursive: { type : "boolean" }, // Only used in conjunction with groups, when true this will also apply it on sub-groups
			type: { type: "string", enum : ["members", "groups", "frontStatuses", "customFields"] },
		},
		nullable: false,
		additionalProperties: false,
		required: ["id", "type"],
	};

	return validateSchema(schema, body);
}