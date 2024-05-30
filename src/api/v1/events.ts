import { Request, Response } from "express";
import moment from "moment";
import { getCollection } from "../../modules/mongo";
import { validateSchema } from "../../util/validation";
import { logOpenUsage } from "./events/open";

export const event = async (req: Request, res: Response) => {
	const events: { time: number; event: string }[] = req.body.events;

	events.forEach((value) => {
		const eventName = value.event;
		const update = { $inc: { count: 1 } };

		const logTime = moment(value.time);
		const date = logTime.startOf("day");
		getCollection("events").updateOne({ date: date.toDate(), event: eventName }, update, { upsert: true });
	});

	res.status(200).send();
};

// Track daily users anonymounsly by storing "lastOpen" in a user and if it's older than today, increment the daily usage count.
export const openEvent = async (_req: Request, res: Response) => {
	const privateUser = await getCollection("private").findOne({ uid: res.locals.uid, _id: res.locals.uid });

	if (!privateUser) {
		res.status(404).send();
		return;
	}

	logOpenUsage(res.locals.uid);

	res.status(200).send();
};

export const validateEventSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			events: {
				type: "array",
				items: {
					type: "object",
					properties: {
						event: { type: "string", pattern: "^[a-zA-Z-_/# ]{1,}$" },
						time: { type: "number", minimum: 0 },
					},
					nullable: false,
					additionalProperties: false,
					required: ["event", "time"],
				},
				uniqueItems: true,
			},
		},
		nullable: false,
		additionalProperties: false,
		required: ["events"],
	};

	return validateSchema(schema, body);
};
