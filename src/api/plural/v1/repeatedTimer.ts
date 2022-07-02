import { Request, Response } from "express";
import { repeatRemindersEvent } from "../../../modules/events/repeatReminders";
import { getCollection, parseId } from "../../../modules/mongo";
import { addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument, sendDocument } from "../../../util";
import { SimplyPluralDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

const convertTimerToInt = (document: any) => {
	// Convert values to numbers, they were previously stored as strings
	if (document) {
		if (document.time) {
			document.time.hour = Number(document.time.hour ?? 0)
			document.time.minute = Number(document.time.minute ?? 0)
		}

		if (document.startTime) {
			document.startTime.year = Number(document.startTime.year ?? 0)
			document.startTime.month = Number(document.startTime.month ?? 0)
			document.startTime.day = Number(document.startTime.day ?? 0)
		}
	}
}

export const getRepeatedTimers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "repeatedReminders", SimplyPluralDb, {}, (doc) => {
		convertTimerToInt(doc)
		return Promise.resolve();
	});
}

export const get = async (req: Request, res: Response) => {
	const document = await getCollection("repeatedReminders", SimplyPluralDb).findOne({ _id: parseId(req.params.id), uid: req.params.system ?? res.locals.uid });

	convertTimerToInt(document)

	sendDocument(req, res, "repeatedReminders", document);
}

export const add = async (req: Request, res: Response) => {
	await addSimpleDocument(req, res, "repeatedReminders", SimplyPluralDb);
	repeatRemindersEvent(res.locals.uid)
}

export const update = async (req: Request, res: Response) => {
	await updateSimpleDocument(req, res, "repeatedReminders", SimplyPluralDb)
	repeatRemindersEvent(res.locals.uid)

}

export const del = async (req: Request, res: Response) => {
	getCollection("queuedEvents", SimplyPluralDb).deleteMany({ uid: res.locals.uid, reminderId: req.params.id });
	deleteSimpleDocument(req, res, "repeatedReminders", SimplyPluralDb);
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