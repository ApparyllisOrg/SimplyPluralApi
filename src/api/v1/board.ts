import { Request, Response } from "express";
import { addSimpleDocument, deleteSimpleDocument, fetchCollection, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";

export const getBoardMessagesForMember = async (req: Request, res: Response) => {
	fetchCollection(req, res, "boardMessages", { uid: res.locals.uid, writtenFor: req.params.id });
};

export const getUnreadMessages = async (req: Request, res: Response) => {
	fetchCollection(req, res, "boardMessages", { uid: res.locals.uid, read: false });
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "boardMessages");
};

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "boardMessages");
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "boardMessages");
};

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "boardMessages");
};

const s_validateBoardMessageSchema = {
	type: "object",
	properties: {
		title: { type: "string", maxLength: 70 },
		message: { type: "string", maxLength: 400 },
		writtenBy: { type: "string", pattern: "^[A-Za-z0-9]{5,50}$" },
		writtenFor: { type: "string", pattern: "^[A-Za-z0-9]{5,50}$" },
		read: { type: "boolean", enum: [false] },
		writtenAt: { type: "number" },
		supportMarkdown: { type: "boolean" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["title", "message", "writtenBy", "writtenFor", "read", "writtenAt", "supportMarkdown"],
};
const v_validateBoardMessageSchema = ajv.compile(s_validateBoardMessageSchema);

export const validateBoardMessageSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateBoardMessageSchema, body);
};

const s_validateCommentPatchSchema = {
	type: "object",
	properties: {
		read: { type: "boolean" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["read"],
};
const v_validateCommentPatchSchema = ajv.compile(s_validateCommentPatchSchema);

export const validateBoardMessagePatchSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateCommentPatchSchema, body);
};
