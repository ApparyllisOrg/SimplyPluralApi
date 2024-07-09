import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, sendQuery, updateSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";

export const getCommentsForDocument = async (req: Request, res: Response) => {
	const query = await getCollection("comments").find({ uid: res.locals.uid, documentId: req.params.id, collection: req.params.type });
	sendQuery(req, res, "comments", query.stream());
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "comments");
};

export const validateCollection = (collection: string) => {
	return collection === "frontHistory";
};

export const add = async (req: Request, res: Response) => {
	if (!validateCollection(req.body.collection)) {
		res.status(400).send("Collection is not comment-supported");
		return;
	}

	const attachedDocument = await getCollection(req.body.collection).findOne({ _id: parseId(req.body.documentId), uid: res.locals.uid });
	if (!attachedDocument) {
		res.status(404).send("Document not found for which you wish to add a comment");
	} else {
		// Increment the comment count
		await getCollection(req.body.collection).updateOne({ _id: parseId(req.body.documentId) }, { $inc: { commentCount: 1 } });
		addSimpleDocument(req, res, "comments");
	}
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "comments");
};

export const del = async (req: Request, res: Response) => {
	const originalComment = await getCollection("comments").findOne({ _id: parseId(req.params.id), uid: res.locals.uid });
	if (!originalComment) {
		res.status(404).send("Cannot find the comment you wish to delete");
	} else {
		// Decrement the comment count
		await getCollection(originalComment.collection).updateOne({ _id: parseId(originalComment.documentId), uid: res.locals.uid }, { $inc: { commentCount: -1 } });
		deleteSimpleDocument(req, res, "comments");
	}
};

const s_validateCommentSchema = {
	type: "object",
	properties: {
		time: { type: "number" },
		text: { type: "string" },
		supportMarkdown: { type: "boolean" },
		documentId: { type: "string" },
		collection: { type: "string" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["time", "text", "documentId", "collection"],
};
const v_validateCommentSchema = ajv.compile(s_validateCommentSchema)

export const validateCommentSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateCommentSchema, body);
};

const s_validateCommentPatchSchema = {
	type: "object",
	properties: {
		text: { type: "string" },
		supportMarkdown: { type: "boolean" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["text"],
};
const v_validateCommentPatchSchema = ajv.compile(s_validateCommentPatchSchema)

export const validateCommentPatchSchema = (body: unknown): { success: boolean; msg: string } => {

	return validateSchema(v_validateCommentPatchSchema, body);
};
