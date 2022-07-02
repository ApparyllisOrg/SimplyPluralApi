import { Request, Response } from "express";
import { getCollection, parseId } from "../../../modules/mongo";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, sendDocuments, updateSimpleDocument } from "../../../util";
import { SimplyPluralDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

export const getCommentsForDocument = async (req: Request, res: Response) => {
	const documents = await getCollection("comments", SimplyPluralDb).find({ uid: res.locals.uid, documentId: req.params.id, collection: req.params.type }).toArray();
	sendDocuments(req, res, "comments", documents);
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "comments", SimplyPluralDb);
}

export const add = async (req: Request, res: Response) => {
	const attachedDocument = await getCollection(req.body.collection, SimplyPluralDb).findOne({ _id: parseId(req.body.documentId) });
	if (!attachedDocument) {
		res.status(404).send("Document not found for which you wish to add a comment")
	}
	else {
		// Increment the comment count
		await getCollection(req.body.collection, SimplyPluralDb).updateOne({ _id: parseId(req.body.documentId) }, { $inc: { commentCount: 1 } });
		addSimpleDocument(req, res, "comments", SimplyPluralDb);
	}
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "comments", SimplyPluralDb)
}

export const del = async (req: Request, res: Response) => {
	const originalComment = await getCollection("comments", SimplyPluralDb).findOne({ _id: parseId(req.params.id), uid: res.locals.uid });
	if (!originalComment) {
		res.status(404).send("Cannot find the comment you wish to delete")
	}
	else {
		// Decrement the comment count
		await getCollection(originalComment.collection, SimplyPluralDb).updateOne({ _id: parseId(originalComment.documentId), uid: res.locals.uid }, { $inc: { commentCount: -1 } });
		deleteSimpleDocument(req, res, "comments", SimplyPluralDb);
	}
}

export const validateCommentSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			time: { type: "number" },
			text: { type: "string" },
			documentId: { type: "string" },
			collection: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
		required: ["time", "text", "documentId", "collection"]
	};

	return validateSchema(schema, body);
}

export const validateCommentPatchSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			text: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["text"]
	};

	return validateSchema(schema, body);
}