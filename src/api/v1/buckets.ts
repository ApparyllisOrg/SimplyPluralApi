import assert from "assert";
import { getCollection, parseId } from "../../modules/mongo";
import { fetchSimpleDocument, fetchCollection, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument } from "../../util";
import { Request, Response } from "express";
import { ajv, validateSchema } from "../../util/validation";

export const getPrivacyBucket = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "privacyBuckets");
};

export const getPrivacyBuckets = async (req: Request, res: Response) => {
	fetchCollection(req, res, "privacyBuckets", {});
};

export const addPrivacyBucket = async (req: Request, res: Response) => {
	await addSimpleDocument(req, res, "privacyBuckets");
};

export const updatePrivacyBucket = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "privacyBuckets");
};

export const deletePrivacyBucket = async (req: Request, res: Response) => {

    assert(req.params.id);

	//@ts-ignore
	await getCollection("members").updateMany({ uid: res.locals.uid }, { $pull: { buckets: parseId(req.params.id) }});
	//@ts-ignore
	await getCollection("frontStatuses").updateMany({ uid: res.locals.uid }, { $pull: { buckets: parseId(req.params.id) }});
	//@ts-ignore
	await getCollection("groups").updateMany({ uid: res.locals.uid }, { $pull: { buckets: parseId(req.params.id) }});
	//@ts-ignore
	await getCollection("friends").updateMany({ uid: res.locals.uid }, { $pull: { buckets: parseId(req.params.id) }});
	//@ts-ignore
	await getCollection("private").updateMany({ uid: res.locals.uid, _id: res.locals.uid }, { $pull: { 
		"defaultPrivacy.members": req.params.id,
		"defaultPrivacy.groups": req.params.id,
		"defaultPrivacy.customFronts": req.params.id,
		"defaultPrivacy.customFields": req.params.id 
	}});

	deleteSimpleDocument(req, res, "privacyBuckets");
};

const s_validateBucketSchema = {
	type: "object",
	properties: {
		name: { type: "string", maxLength: 150, minLength: 1 },
		desc: { type: "string", maxLength: 500, minLength: 0  },
		color: { type: "string", maxLength: 10 },
		icon: { type: "string", maxLength: 5 },
		rank: { type: "string", pattern: "^0\|[a-z0-9]{6,}(:)?[a-z0-9]{0,}$" },
	},
	required: ["name", "desc", "color", "icon", "rank"],
	nullable: false,
	additionalProperties: false,	
};
const v_validateBucketSchema = ajv.compile(s_validateBucketSchema)

export const validateBucketSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateBucketSchema, body);
};
