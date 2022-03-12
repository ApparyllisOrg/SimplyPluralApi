import { Request, Response } from "express";
import { repeatRemindersEvent } from "../../modules/events/repeatReminders";
import { getCollection } from "../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getRepeatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "repeatedReminders", {});
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "repeatedReminders");
}

export const add = async (req: Request, res: Response) => {
	await addSimpleDocument(req, res, "repeatedReminders");
	repeatRemindersEvent(res.locals.uid)
}

export const update = async (req: Request, res: Response) => {
	await updateSimpleDocument(req, res, "repeatedReminders")
	repeatRemindersEvent(res.locals.uid)

}

export const del = async (req: Request, res: Response) => {
	getCollection("queuedEvents").deleteMany({ uid: res.locals.uid, reminderId: req.params.id });
	deleteSimpleDocument(req, res, "repeatedReminders");
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