import { Request, Response } from "express";
import moment from "moment";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection } from "../../modules/mongo";
import { canSeeMembers } from "../../security";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { getPrivacyDependency, validateSchema } from "../../util/validation";

export const getCustomFronts = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid);
		if (!canSee) {
			res.status(403).send("You are not authorized to see custom fronts of this user");
			return;
		}
	}
	fetchCollection(req, res, "frontStatuses", {});
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "frontStatuses");
};

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "frontStatuses");
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "frontStatuses");

	// If this cf is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });
	if (fhLive) {
		frontChange(res.locals.uid, false, req.params.id, false);
	}
};

export const del = async (req: Request, res: Response) => {
	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });

	await getCollection("frontHistory").updateOne({ uid: res.locals.uid, member: req.params.id, live: true }, { $set: { live: false, endTime: moment.now() } });

	if (fhLive) {
		frontChange(res.locals.uid, true, req.params.id, false);
	}

	deleteSimpleDocument(req, res, "frontStatuses");
};

export const validateCustomFrontSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			avatarUrl: { type: "string" },
			avatarUuid: { type: "string" },
			color: { type: "string" },
			preventTrusted: { type: "boolean" },
			private: { type: "boolean" },
			supportDescMarkdown: { type: "boolean" },
		},
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};

export const validatePostCustomFrontSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			avatarUrl: { type: "string" },
			avatarUuid: { type: "string" },
			color: { type: "string" },
			preventTrusted: { type: "boolean" },
			private: { type: "boolean" },
			supportDescMarkdown: { type: "boolean" },
		},
		required: ["name", "private", "preventTrusted"],
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};
