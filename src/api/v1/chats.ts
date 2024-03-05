import { Request, Response } from "express";
import moment from "moment";
import { ObjectId } from "mongodb";
import * as Sentry from "@sentry/node";
import { getCollection, parseId } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchCollection, sendDocument } from "../../util";
import { validateSchema } from "../../util/validation";
import { decryptMessage, encryptMessage } from "./chat/chat.core";

export const getChannelHistory = async (req: Request, res: Response) => {
	const query: any = { channel: req.params.id };

	if (req.query.skipTo?.toString() && req.query.sortOrder?.toString()) {
		const sortOrder = req.query.sortOrder?.toString();
		if (sortOrder === "-1") {
			query["_id"] = { $lt: parseId(req.query.skipTo?.toString()) };
		} else if (sortOrder === "1") {
			query["_id"] = { $gt: parseId(req.query.skipTo?.toString()) };
		} else {
			Sentry.captureMessage("Invalid sort order found!");
			res.status(500).send();
		}
	}

	fetchCollection(req, res, "chatMessages", query, (document) => {
		if (document.iv) {
			document.message = decryptMessage(document.message, document.iv);
			delete document.iv;
		}

		return document;
	});
};

export const getChannel = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "channels");
};

export const getChannels = async (req: Request, res: Response) => {
	fetchCollection(req, res, "channels", {});
};

export const addChannel = async (req: Request, res: Response) => {
	await addSimpleDocument(req, res, "channels");
};

export const updateChannel = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "channels");
};

export const deleteChannel = async (req: Request, res: Response) => {
	await getCollection("chatMessages").deleteMany({ uid: res.locals.uid, channel: parseId(req.params.id) });

	await getCollection("channelCategories").updateOne({ uid: res.locals.uid }, { $pull: { channels: req.params.id.toString() } });

	deleteSimpleDocument(req, res, "channels");
};

export const getChannelCategory = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "channelCategories");
};

export const getChannelCategories = async (req: Request, res: Response) => {
	fetchCollection(req, res, "channelCategories", {});
};

const verifyValidChannelsPayload = async (req: Request, res: Response) => {
	// TODO: Ensure a channel can only belong to one category

	// Ensure all channels exist
	if (req.body.channels) {
		const validChannels = await getCollection("channels").find({ uid: res.locals.uid }).toArray();

		const channels: string[] = req.body.channels;

		// Remove non-existing channels
		for (let i = channels.length - 1; i >= 0; --i) {
			const channel = channels[i];
			const channelDoc = validChannels.findIndex((value) => value._id.toString() === channel);
			if (channelDoc == -1) {
				channels.splice(i, 1);
			}
		}

		req.body.channels = channels;
	}
};

export const addChannelCategory = async (req: Request, res: Response) => {
	const dataObj: documentObject = req.body;
	dataObj._id = res.locals.useId ?? new ObjectId();

	await verifyValidChannelsPayload(req, res);

	addSimpleDocument(req, res, "channelCategories");

	// Insert the category at the end
	await getCollection("private").updateOne({ uid: res.locals.uid, _id: res.locals.uid }, { $addToSet: { categories: dataObj._id.toString() } });
};

export const updateChannelCategory = async (req: Request, res: Response) => {
	await verifyValidChannelsPayload(req, res);

	updateSimpleDocument(req, res, "channelCategories");
};

export const deleteChannelCategory = async (req: Request, res: Response) => {
	await getCollection("channels").updateMany({ uid: res.locals.uid }, { $set: { category: "" } });
	await getCollection("private").updateOne({ uid: res.locals.uid, _id: res.locals.uid }, { $pull: { categories: req.params.id } });
	deleteSimpleDocument(req, res, "channelCategories");
};

export const getMessage = async (req: Request, res: Response) => {
	const document = await getCollection("chatMessages").findOne({ _id: parseId(req.params.id), uid: req.params.system ?? res.locals.uid });

	if (document && document.iv) {
		document.message = decryptMessage(document.message, document.iv);
		delete document.iv;
	}

	sendDocument(req, res, "chatMessages", document);
};

export const writeMessage = async (req: Request, res: Response) => {
	// Clamp writtenAt to now
	if (req.body.writtenAt > moment.now()) {
		req.body.writtenAt = moment.now();
	}

	const channel = await getCollection("channels").findOne({ uid: res.locals.uid, _id: parseId(req.body.channel) });
	if (!channel) {
		await getCollection("undeliveredMessages").insertOne({ uid: res.locals.uid, message: req.body, reason: "channel not found" });
		res.status(404).send("Can't find the channel this messages is supposed to go to, message cannot be delivered. We saved the message in case you would like to resend it with the correct channel. Saved undelivered messages will automatically be deleted after 30 days.");
		return;
	}

	const memberWriter = await getCollection("members").findOne({ uid: res.locals.uid, _id: parseId(req.body.writer) });
	if (!memberWriter) {
		await getCollection("undeliveredMessages").insertOne({ uid: res.locals.uid, message: req.body, reason: "Member not found" });
		res.status(404).send("Member who wrote this message not found, message cannot be delivered. We saved the message in case you would like to resend it with the correct member. Saved undelivered messages will automatically be deleted after 30 days.");
		return;
	}

	if (req.body.replyTo) {
		const replyToMessage = await getCollection("chatMessages").findOne({ uid: res.locals.uid, _id: parseId(req.body.replyTo), channel: req.body.channel });
		if (!replyToMessage) {
			await getCollection("undeliveredMessages").insertOne({ uid: res.locals.uid, message: req.body, reason: "Reply-to not found" });
			res.status(404).send("Can't find the message this message is supposed to reply to, message cannot be delivered. We saved the message in case you would like to resend it with the correct reply-to. Saved undelivered messages will automatically be deleted after 30 days.");
			return;
		}
	}

	const encrpyted = encryptMessage(req.body.message);
	req.body.message = encrpyted.msg;
	req.body.iv = encrpyted.iv;

	addSimpleDocument(req, res, "chatMessages");
};

export const updateMessage = async (req: Request, res: Response) => {
	// Clamp updatedAt to now
	if (req.body.updatedAt > moment.now()) {
		req.body.updatedAt = moment.now();
	}

	if (req.body.message) {
		const encrpyted = encryptMessage(req.body.message);
		req.body.message = encrpyted.msg;
		req.body.iv = encrpyted.iv;
	}

	updateSimpleDocument(req, res, "chatMessages");
};

export const deleteMessage = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "chatMessages");
};

export const validateWriteMessageSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			message: { type: "string", maxLength: 2500, minLength: 1 },
			channel: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
			writer: { type: "string", pattern: "^[A-Za-z0-9]{5,50}$" },
			writtenAt: { type: "number" },
			replyTo: { type: "string", pattern: "^$|[A-Za-z0-9]{20,50}$" },
		},
		required: ["message", "channel", "writer", "writtenAt"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};

export const validateUpdateMessageSchema = (body: unknown): { success: boolean; msg: string } => {
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
};

export const validateWriteChannelschema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string", maxLength: 2000 },
			// color: { type: "string", pattern: "^$|^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$"} Color is currently not supported
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};

export const validateChatCategorySchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string", maxLength: 100, minLength: 1 },
			desc: { type: "string", maxLength: 2000 },
			channels: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};

export const validateGetChannelHistorySchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			limit: { type: "string", pattern: "^[1-9][0-9]?$|^100$" },
			skip: { type: "string", pattern: "^[0-9]{1,}" },
			skipTo: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
			sortOrder: { type: "string", pattern: "^-1$|^1$" },
			sortBy: { type: "string", pattern: "^[A-Za-z0-9]{1,50}$" },
		},
		required: ["limit"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};
