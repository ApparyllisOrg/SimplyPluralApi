import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../../util";
import { SimplyPluralDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

export const getAutomatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "automatedReminders",SimplyPluralDb, {});
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "automatedReminders", SimplyPluralDb);
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "automatedReminders", SimplyPluralDb);
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "automatedReminders", SimplyPluralDb)
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "automatedReminders", SimplyPluralDb);
}

export const validateAutomatedTimerSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			message: { type: "string" },
			action: { type: "number" },
			delayInHours: { type: "number" },
			type: { type: "number" },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}