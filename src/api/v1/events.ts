import { Request, Response } from "express";
import moment from "moment";
import { getCollection } from "../../modules/mongo";
import { validateSchema } from "../../util/validation";

export const event = async (req: Request, res: Response) => {
	const eventName =  req.body.event
	const update = { $inc: { count : 1 }}

	const logTime = moment(res.locals.operationTime)
	const date = logTime.startOf("day")

	await getCollection("events").updateOne({date: date.toDate(), event: eventName}, update, { upsert: true })

	res.status(200).send()
}

// Track daily users anonymounsly by storing "lastOpen" in a user and if it's older than today, increment the daily usage count.
export const openEvent = async (req: Request, res: Response) => {
	const privateUser = await getCollection("private").findOne({uid: res.locals.uid})

	if (!privateUser)
	{
		res.status(404).send()
		return
	}

	let lastOpen = privateUser.lastOpen ?? 0;

	const today = moment()
	const startOfDay = today.startOf("day")

	if (lastOpen < startOfDay.valueOf())
	{
		await getCollection("private").updateOne({uid: res.locals.uid}, {$set: { lastOpen }})
		await getCollection("events").updateOne({date: startOfDay, event: "dailyUsage"}, {$inc: {count : 1}}, { upsert: true })
	}

	res.status(200).send()
}

export const validateEventSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			event: { type: "string", pattern: "^[a-zA-Z-_]{1,}$"  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["event"]
	};

	return validateSchema(schema, body);
}
