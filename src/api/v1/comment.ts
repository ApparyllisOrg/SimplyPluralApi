import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, sendDocuments, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getCommentsForDocument = async (req: Request, res: Response) => {
	const documents = await getCollection("comments").find({ uid: res.locals.uid, documentId: req.params.document }).toArray();
	sendDocuments(req, res, "comments", documents);
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "comments");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "comments");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "comments")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "comments");
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
	};

	return validateSchema(schema, body);
}