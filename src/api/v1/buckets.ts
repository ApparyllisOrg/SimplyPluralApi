import assert from "assert";
import { getCollection, parseId } from "../../modules/mongo";
import { fetchSimpleDocument, fetchCollection, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument } from "../../util";
import { Request, Response } from "express";
import { validateSchema } from "../../util/validation";


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
	await getCollection("members").updateMany({ uid: res.locals.uid }, { $pull: { $eq: {privacyBuckets: req.params.id.toString() }}});
	//@ts-ignore
	await getCollection("customFronts").updateMany({ uid: res.locals.uid }, { $pull: { privacyBuckets: req.params.id.toString() }});
	//@ts-ignore
	await getCollection("groups").updateMany({ uid: res.locals.uid }, { $pull: { privacyBuckets: req.params.id.toString() }});

	deleteSimpleDocument(req, res, "channels");
};


export const validateBucketSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 150, minLength: 1 },
			description: { type: "string", maxLength: 500, minLength: 1  },
			color: { type: "string", maxLength: 10 },
			icon: { type: "string", maxLength: 5 },
		},
		required: ["name", "description", "color", "icon"],
		nullable: false,
		additionalProperties: false,	};

	return validateSchema(schema, body);
};