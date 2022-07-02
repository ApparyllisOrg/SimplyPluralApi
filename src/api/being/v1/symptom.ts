import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../../util";
import { SimplyBeingDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

export const getAll = async (req: Request, res: Response) => {
	fetchCollection(req, res, "symptoms", SimplyBeingDb, {});
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "symptoms", SimplyBeingDb);
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "symptoms", SimplyBeingDb);
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "symptoms", SimplyBeingDb)
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "symptoms", SimplyBeingDb);
	getCollection("symptomLogs", SimplyBeingDb).deleteMany({uid: res.locals.uid, ref: req.params.id})
}

export const validatePostSymptomSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			group: { type: "string" }
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validatePatchSymptomSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			group: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}