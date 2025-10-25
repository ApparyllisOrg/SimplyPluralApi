import { Request, Response } from "express"
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchCollection } from "../../util"
import { ajv, validateSchema } from "../../util/validation"

export const getFilters = async (req: Request, res: Response) => {
	fetchCollection(req, res, "filters", {})
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "filters")
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "filters")
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "filters")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "filters")
}

const textFilterSchema = {
	type: "object",
	properties: {
		type: { type: "string", enum: ["name", "desc", "pronouns", "pkId", "customFields", "archivedReason"] },
		payload: {
			type: "object",
			properties: {
				query: { type: "string", maxLength: 250 },
				condition: { type: "string", enum: ["Contains", "DoesNotContain", "Equals", "DoesNotEqual", "StartsWith", "EndsWith"] },
			},
			required: ["query", "condition"],
			nullable: false,
			additionalProperties: false,
		},
	},
	required: ["type", "payload"],
	nullable: false,
	additionalProperties: false,
}

const booleanFilterSchema = {
	type: "object",
	properties: {
		type: { type: "string", enum: ["archived", "preventsFrontNotifs"] },
		payload: {
			type: "object",
			properties: {
				query: { type: "boolean" },
			},
			required: ["query"],
			nullable: false,
			additionalProperties: false,
		},
	},
	required: ["type", "payload"],
	nullable: false,
	additionalProperties: false,
}

const customFieldFilterSchema = {
	type: "object",
	properties: {
		type: { type: "string", enum: ["customField"] },
		payload: {
			type: "object",
			properties: {
				query: { type: "string", maxLength: 250 },
				condition: { type: "string", enum: ["Contains", "DoesNotContain", "Equals", "DoesNotEqual", "StartsWith", "EndsWith"] },
				id: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
			},
			required: ["query", "condition", "id"],
			nullable: false,
			additionalProperties: false,
		},
	},
	required: ["type", "payload"],
	nullable: false,
	additionalProperties: false,
}

const avatarFilterSchema = {
	type: "object",
	properties: {
		type: { type: "string", enum: ["avatar"] },
		payload: {
			type: "object",
			properties: {
				condition: { type: "string", enum: ["HasAvatar", "HasNoAvatar", "HasUploadedAvatar", "HasUrlAvatar"] },
			},
			required: ["condition"],
			nullable: false,
			additionalProperties: false,
		},
	},
	required: ["type", "payload"],
	nullable: false,
	additionalProperties: false,
}

const bucketFilterSchema = {
	type: "object",
	properties: {
		type: { type: "string", enum: ["buckets"] },
		payload: {
			type: "object",
			properties: {
				condition: { type: "string", enum: ["HasAnyOf", "HasAllOf", "HasNoneOf", "HasNoBuckets", "HasAnyBucket"] },
				buckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" } },
			},
			required: ["condition", "buckets"],
			nullable: false,
			additionalProperties: false,
		},
	},
	required: ["type", "payload"],
	nullable: false,
	additionalProperties: false,
}

const s_filterSchema = {
	name: { type: "string", maxLength: 150, minLength: 1 },
	desc: { type: "string", maxLength: 1000, minLength: 0 },
	color: { type: "string", maxLength: 10 },
	icon: { type: "string", format: "emoji3" },
	op: { type: "string", enum: ["and", "or"] },
	order: { type: "string", pattern: "^0|[a-z0-9]{6,}(:)?[a-z0-9]{0,}$" },
	items: {
		type: "array",
		minItems: 0,
		maxItems: 50,
		items: {
			anyOf: [textFilterSchema, booleanFilterSchema, customFieldFilterSchema, avatarFilterSchema, bucketFilterSchema],
		},
	},
}

const s_filterPostSchema = {
	type: "object",
	properties: s_filterSchema,
	required: ["name", "desc", "color", "icon", "op", "order", "entries"],
	nullable: false,
	additionalProperties: false,
}

const v_validatePostFilterSchema = ajv.compile(s_filterPostSchema)

export const validatePostFilterSchema = (body: unknown): { success: boolean; msg: string } => {
	const result = validateSchema(v_validatePostFilterSchema, body)
	if (!result.success) {
		return result
	}

	return result
}

const s_filterPatchSchema = {
	type: "object",
	properties: s_filterSchema,
	required: [],
	nullable: false,
	additionalProperties: false,
}

const v_validatePatchFilterSchema = ajv.compile(s_filterPatchSchema)

export const validatePatchFilterSchema = (body: unknown): { success: boolean; msg: string } => {
	const result = validateSchema(v_validatePatchFilterSchema, body)
	if (!result.success) {
		return result
	}

	return result
}
