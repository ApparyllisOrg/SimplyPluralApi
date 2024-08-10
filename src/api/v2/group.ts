import { Request, Response } from "express";
import { addSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "groups");
};

const s_validatePostGroupSchema = {
	type: "object",
	properties: {
		parent: { type: "string" },
		color: { type: "string" },
		name: { type: "string" },
		desc: { type: "string" },
		emoji: { type: "string" },
		members: { type: "array", items: { type: "string" }, uniqueItems: true },
		supportDescMarkdown: { type: "boolean" },
	},
	required: ["parent", "color", "name", "desc", "emoji", "members"],
	nullable: false,
	additionalProperties: false,
};
const v_validatePostGroupSchema = ajv.compile(s_validatePostGroupSchema)

export const validatePostGroupSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostGroupSchema, body);
};
