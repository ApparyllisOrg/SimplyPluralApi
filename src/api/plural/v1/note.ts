import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument } from "../../../util";
import { SimplyPluralDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

export const getNotesForMember = async (req: Request, res: Response) => {
	const documents = await getCollection("notes", SimplyPluralDb).find({ uid: req.params.system, member: req.params.member }).toArray();
	sendDocuments(req, res, "notes", documents)
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "notes", SimplyPluralDb);
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "notes", SimplyPluralDb);
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "notes", SimplyPluralDb)
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "notes", SimplyPluralDb);
}

export const validateNoteSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			title: { type: "string" },
			note: { type: "string" },
			color: { type: "string" },
			member: { type: "string" },
			date: { type: "number" },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}