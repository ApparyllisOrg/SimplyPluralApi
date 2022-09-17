import { Request, Response } from "express";
import moment from "moment";
import { ObjectID } from "mongodb";
import { getCollection, parseId } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getChannelHistory = async (req: Request, res: Response) => {
	fetchCollection(req, res, "chatMessages", { channel: req.params.id });
}

export const getChannel = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "channels");
}

export const getChannels = async (req: Request, res: Response) => {
	fetchCollection(req, res, "channels", {});
}

export const addChannel = async (req: Request, res: Response) => {
	await addSimpleDocument(req, res, "channels");
}

export const updateChannel = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "channels")
}

export const deleteChannel = async (req: Request, res: Response) => {
	await getCollection("chatMessages").deleteMany({uid: res.locals.uid, channel: parseId(req.params.id)})
	deleteSimpleDocument(req, res, "channels")
}

export const getChannelCategory = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "channelCategories");
}

export const getChannelCategories = async (req: Request, res: Response) => {
	fetchCollection(req, res, "channelCategories", {});
}

export const addChannelCategory = async (req: Request, res: Response) => {
	const dataObj: documentObject = req.body;
	dataObj._id = res.locals.useId ?? new ObjectID();
	
	addSimpleDocument(req, res, "channelCategories");

	const privateUser = await getCollection("private").findOne({uid: res.locals.uid, _id: res.locals.uid});
	const categories = privateUser.categories ?? [];
	categories.push(dataObj._id.toString())

	// Insert the category at the end
	await getCollection("private").updateOne({uid: res.locals.uid, _id: res.locals.uid}, {$set: {categories: categories}})
}

export const updateChannmelCategory = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "channelCategories")
}

export const deleteChannelCategory = async (req: Request, res: Response) => {
	await getCollection("channels").updateMany({uid: res.locals.uid}, {$set: {category: ""}})
	deleteSimpleDocument(req, res, "channelCategories")
}

export const getMessage = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "chatMessages");
}

export const writeMessage = async (req: Request, res: Response) => {

	// Clamp writtenAt to now
	if (req.body.writtenAt > moment.now())
	{
		req.body.writtenAt = moment.now();
	}

	const channel = await getCollection("channels").findOne({uid: res.locals.uid, _id: parseId(req.body.channel)})
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
	// Clamp updatedAt to now
	if (req.body.updatedAt > moment.now())
	{
		req.body.updatedAt = moment.now();
	}

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
			channel: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
			writer: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$"  },
			writtenAt: { type: "number" },
			replyTo: { type: "string", pattern: "^$|[A-Za-z0-9]{20,50}$" },
		},
		required: ["message", "channel", "writer", "writtenAt"],
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
			updatedAt: { type: "number" },
		},
		required: ["message", "updatedAt"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateAddChannelschema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string",  maxLength: 2000 },
			color: { type: "string", pattern: "^$|^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$"}
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateUpdateChannelschema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string",  maxLength: 2000 },
			color: { type: "string", pattern: "^$|^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$"}
		},
		required: ["name", "desc"],
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
			desc: { type: "string",  maxLength: 2000 },
			channels: { type: "array",  items: { type: "string", pattern: "^[A-Za-z0-9]{30,50}$" }}
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}