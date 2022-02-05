import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getRepeatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "repeatedTimers", {});
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "repeatedTimers");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "repeatedTimers");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "repeatedTimers")
}

export const del = async (req: Request, res: Response) => {
	getCollection("queuedEvents").deleteMany({ uid: res.locals.uid, reminderId: req.params.id });
	deleteSimpleDocument(req, res, "repeatedTimers");
}

export const validateRepeatedTimerSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			message: { type: "string" },
			dayInterval: { type: "number" },
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