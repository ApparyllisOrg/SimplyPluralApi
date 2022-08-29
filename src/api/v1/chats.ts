import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getChatHistory = async (req: Request, res: Response) => {
	fetchCollection(req, res, "chatMessages", { channel: req.params.id });
}

export const getChat = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "channels");
}

export const addChat = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "channels");
}

export const updateChat = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "channels")
}

export const deleteChat = async (req: Request, res: Response) => {
	await getCollection("chatMessages").deleteMany({uid: res.locals.uid, channel: parseId(req.params.id)})
	deleteSimpleDocument(req, res, "channels")
}

export const getChatCategory = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "chatCategories");
}

export const addChatCategory = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "chatCategories");
}

export const updateChatCategory = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "chatCategories")
}

export const deleteChatCategory = async (req: Request, res: Response) => {
	await getCollection("channels").updateMany({uid: res.locals.uid}, {$set: {category: ""}})
	deleteSimpleDocument(req, res, "chatCategories")
}

export const getMessage = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "chatMessages");
}

export const writeMessage = async (req: Request, res: Response) => {
	const channel = await getCollection("channels").findOne({uid: res.locals.uid, _id: req.body.channel})
	if (!channel)
	{
		await getCollection("undeliveredMessages").insertOne({uid: res.locals.uid, message: req.body, reason: "channel not found"})
		res.status(404).send("Can't find the channel this messages is supposed to go to, message cannot be delivered. We saved the message in case you would like to resend it with the correct channel. Saved undelivered messages will automatically be deleted after 30 days.")
		return
	}

	const memberWriter = await getCollection("members").findOne({uid: res.locals.uid, _id: parseId(req.body.writer)})
	if (!memberWriter)
	{
		await getCollection("undeliveredMessages").insertOne({uid: res.locals.uid, message: req.body, reason: "Member not found"})
		res.status(404).send("Member who wrote this message not found, message cannot be delivered. We saved the message in case you would like to resend it with the correct member. Saved undelivered messages will automatically be deleted after 30 days.")
		return
	}

	if (req.body.replyTo)
	{
		const replyToMessage = await getCollection("chatMessages").findOne({uid: res.locals.uid, _id: parseId(req.body.replyTo), channel: req.body.channel})
		if (!replyToMessage)
		{
			await getCollection("undeliveredMessages").insertOne({uid: res.locals.uid, message: req.body, reason: "Reply-to not found"})
			res.status(404).send("Can't find the message this message is supposed to reply to, message cannot be delivered. We saved the message in case you would like to resend it with the correct reply-to. Saved undelivered messages will automatically be deleted after 30 days.")
			return
		}
	}

	addSimpleDocument(req, res, "chatMessages");
}

export const updateMessage = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "chatMessages")
}

export const deleteMessage = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "chatMessages")
}

export const validateWriteMessageSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			message: { type: "string", maxLength: 2500, minLength: 1 },
			channel: { type: "string", pattern: "^[A-Za-z0-9]{30,50}$" },
			writer: { type: "string", pattern: "^[A-Za-z0-9]{30,50}$"  },
			replyTo: { type: "string", pattern: "^[A-Za-z0-9]{30,50}$" },
		},
		required: ["message", "channel", "writer"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateUpdateMessageSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			message: { type: "string", maxLength: 2500, minLength: 1 },
		},
		required: ["message"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateChannelschema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string",  maxLength: 2000 },
			category: { type: "string", pattern: "^[A-Za-z0-9]{30,50}$"  }
		},
		required: ["name", "desc", "category"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateChatCategorySchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string",  maxLength: 2000 }
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}