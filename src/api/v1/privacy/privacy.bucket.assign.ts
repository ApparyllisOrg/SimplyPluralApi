import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { convertListToIds } from "../../../util";
import { validateSchema } from "../../../util/validation";

export const assignBucketsToFriend = async (req: Request, res: Response) => {
	let mongoBucketIds : any[] = await convertListToIds(res.locals.uid, "privacyBuckets", req.body.buckets)

	const result = await getCollection("friends").updateOne({ uid: res.locals.uid, frienduid: req.body.friendUid }, { $set: { privacyBuckets: mongoBucketIds }});
	if (result.modifiedCount === 1)
	{
		res.status(200).send()
		return
	}

	res.status(404).send()
};

export const validateAssignBucketToFriendSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			friendUid: { type: "string", maxLength: 150, minLength: 1 },
			buckets: { type: "array" , items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true, minLength: 1  },
		},
		required: ["friendUid", "buckets",],
		nullable: false,
		additionalProperties: false,	};

	return validateSchema(schema, body);
};