import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getFrontHistoryInRange = async (req: Request, res: Response) => {
	const documents = await getCollection("frontHistory").find({
		$or: [
			{ startTime: { $gte: req.query.start }, endTime: { $lte: req.query.end } },
			{ startTime: { $lte: req.query.start }, endTime: { $gte: req.query.end } },
			{ startTime: { $lte: req.query.start }, endTime: { $gte: req.query.start } },
			{ startTime: { $gte: req.query.end }, endTime: { $lte: req.query.end } }
		]
	}).toArray()
	sendDocuments(req, res, "frontHistory", documents);
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "frontHistory");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "frontHistory");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "frontHistory")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "frontHistory");
}

export const validatefrontHistorySchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
			startTime: { type: "number" },
			endTime: { type: "number" },
			member: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}