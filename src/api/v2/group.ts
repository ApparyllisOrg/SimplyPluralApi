import { Request, Response } from "express"
import { addSimpleDocument } from "../../util"
import { ajv, validateSchema } from "../../util/validation"
import { insertDefaultPrivacyBuckets } from "../v1/privacy/privacy.assign.defaults"

export const add = async (req: Request, res: Response) => {
	const insertBuckets = async (data: any): Promise<void> => {
		await insertDefaultPrivacyBuckets(res.locals.uid, data, "groups")
	}

	addSimpleDocument(req, res, "groups", insertBuckets)
}

const s_validatePostGroupSchema = {
	type: "object",
	properties: {
		parent: { type: "string" },
		color: { type: "string" },
		name: { type: "string" },
		desc: { type: "string" },
		emoji: { type: "string" },
		members: { type: "array", items: { type: "string" }, uniqueItems: true },
		supportDescMarkdown: { type: "boolean", default: true },
	},
	required: ["parent", "color", "name", "desc", "emoji", "members"],
	nullable: false,
	additionalProperties: false,
}
const v_validatePostGroupSchema = ajv.compile(s_validatePostGroupSchema)

export const validatePostGroupSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostGroupSchema, body)
}
