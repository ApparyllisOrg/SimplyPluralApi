import { getCollection } from "../../../modules/mongo";
import { sendDocuments, fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchCollection } from "../../../util";
import { SimplyBeingDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";
import { Request, Response } from "express";

export const getSymptomLogs = async (req: Request, res: Response) => {
	const query = {
		$and: [{ uid: res.locals.uid }, { time: { $gte: Number(req.query.startTime) }}, {time: { $lte: Number(req.query.endTime) } }]
	}
	fetchCollection(req, res,  "symptomLogs", SimplyBeingDb, query)
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "symptomLogs", SimplyBeingDb);
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "symptomLogs", SimplyBeingDb);
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "symptomLogs", SimplyBeingDb)
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "symptomLogs", SimplyBeingDb);
}

export const validatePatchSymptomLogSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			ref: { type: "string" },
			note: { type: "string" },
			severity: { type: "number" },
			time: { type: "number" }
		},
		required: ["ref", "severity", "time"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validatePostSymptomLogSchema = (body: any): { success: boolean, msg: string } => {
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