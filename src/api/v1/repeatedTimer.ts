import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getRepeatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "repeatedTimer", {});
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "repeatedTimer");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "repeatedTimer");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "repeatedTimer")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "repeatedTimer");
}

export const validateRepeatedTimerSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			message: { type: "string" },
			dayInterval: { type: "string" },
			time: {
				type: "object",
				properties: {
					hour: { type: "number" },
					minute: { type: "number" }
				},
				nullable: false,
				additionalProperties: false,
			},
			startTime: {
				type: "object",
				properties: {
					year: { type: "number" },
					month: { type: "number" },
					day: { type: "number" }
				},
				nullable: false,
				additionalProperties: false,
			},
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}