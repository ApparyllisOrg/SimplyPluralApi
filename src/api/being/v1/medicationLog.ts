import { getCollection } from "../../../modules/mongo";
import { sendDocuments, fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchCollection } from "../../../util";
import { SimplyBeingDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";
import { Request, Response } from "express";

export const getMedicationLogs = async (req: Request, res: Response) => {
	const query = {
		$and: [{ uid: res.locals.uid }, { startTime: { $gte: Number(req.query.startTime) }}, {time: { $lte: Number(req.query.endTime) } }]
	}
	fetchCollection(req, res,  "medicationLogs", SimplyBeingDb, query)
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "medicationLogs", SimplyBeingDb);
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "medicationLogs", SimplyBeingDb);
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "medicationLogs", SimplyBeingDb)
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "medicationLogs", SimplyBeingDb);
}

export const validatePatchMedicationLogSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			ref: { type: "string" },
			note: { type: "string" },
			severity: { type: "number" },
			time: { type: "number" }
		},
		required: ["ref", "time"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validatePostMedicationLogSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			ref: { type: "string" },
			note: { type: "string" },
			severity: { type: "number" },
			time: { type: "number" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}