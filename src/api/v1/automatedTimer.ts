import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";

export const getAutomatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "automatedReminders", {});
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "automatedReminders");
};

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "automatedReminders");
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "automatedReminders");
};

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "automatedReminders");
};

const s_validateAutomatedTimerSchema =  {
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
	required: ["name", "message", "delayInHours", "type"],
};
const v_validateAutomatedTimerSchema = ajv.compile(s_validateAutomatedTimerSchema)

export const validateAutomatedTimerSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateAutomatedTimerSchema, body);
};
