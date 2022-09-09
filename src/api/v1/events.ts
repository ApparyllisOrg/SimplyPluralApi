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

export const validateEventSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			event: { type: "string", pattern: "^[a-zA-Z]{1,}$"  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["event"]
	};

	return validateSchema(schema, body);
}
