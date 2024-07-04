import { Request, Response } from "express";
import moment from "moment";
import { getCollection } from "../../modules/mongo";
import { ajv, validateSchema } from "../../util/validation";

export const get = async (_req: Request, res: Response) => {
	let serverData = await getCollection("serverData").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	if (!serverData || !serverData.lastReadMessage) {
		await createServerDataForMessages(res.locals.uid, res.locals.operationTime);
		serverData = await getCollection("serverData").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	}

	// Get all messages
	// If messages is newer
	// If message is ready to show (> now)
	// If message didn't expire yet (< now)
	const pendingMessages = await getCollection("messages")
		.find({ $and: [{ start: { $gte: serverData.lastReadMessage } }, { start: { $lte: moment.now() } }, { end: { $gte: moment.now() } }] }, { sort: { start: -1 } })
		.toArray();

	const results: { title: string; message: string; answer: string; time: number }[] = [];
	pendingMessages.forEach((msg) => {
		results.push({ title: msg.title, message: msg.message, answer: msg.answer, time: msg.start });
	});

	res.status(200).send(results);
};

export const maskAsRead = async (req: Request, res: Response) => {
	let serverData = await getCollection("serverData").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	if (!serverData) {
		await createServerDataForMessages(res.locals.uid, res.locals.operationTime);
		serverData = await getCollection("serverData").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	}

	// TODO: Improve this, if we schedule two or more messages at the exact same time, you can dismiss subsequent messages because they all start on the same time
	// +1 as the time that is sent from the client is the time the message has started
	await getCollection("serverData").updateOne({ uid: res.locals.uid, _id: res.locals.uid }, { $set: { lastReadMessage: req.body.time + 1 } });
	res.status(200).send();
};

export const createServerDataForMessages = async (uid: string, _time: number) => {
	const activeMessages = await getCollection("messages")
		.find({ $and: [{ start: { $lte: moment.now() } }, { end: { $gte: moment.now() } }] })
		.toArray();

	let oldestMessage = Number.MAX_VALUE;

	activeMessages.forEach((msg) => {
		if (oldestMessage > msg.start) {
			oldestMessage = msg.start;
		}
	});

	if (activeMessages.length === 0 || oldestMessage === Number.MAX_VALUE) {
		oldestMessage = moment.now();
	}

	await getCollection("serverData").updateOne({ uid: uid, _id: uid }, { $set: { lastReadMessage: oldestMessage } }, { upsert: true });
};

const s_validateMarkReadSchema = {
	type: "object",
	properties: {
		time: { type: "number" },
	},
	nullable: false,
	required: ["time"],
	additionalProperties: false,
};
const v_validateMarkReadSchema = ajv.compile(s_validateMarkReadSchema)

export const validateMarkReadSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateMarkReadSchema, body);
};
