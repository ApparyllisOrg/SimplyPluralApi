import { Request, Response } from "express"
import { getCollection, parseId } from "../../../modules/mongo"
import { ajv, validateSchema } from "../../../util/validation"

export const orderFields = async (req: Request, res: Response) => {
	const fields: { id: string; order: string }[] = req.body.fields

	for (let i = 0; i < fields.length; ++i) {
		getCollection("customFields").updateOne({ uid: res.locals.uid, _id: parseId(fields[i].id) }, { $set: { order: fields[i].order } })
	}

	res.status(200).send()
}

const s_validateOrderFieldsScheme = {
	type: "object",
	properties: {
		fields: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" },
					order: { type: "string", pattern: "^0|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
				},
				required: ["id", "order"],
				nullable: false,
				additionalProperties: false,
			},
		},
	},
	required: ["fields"],
	nullable: false,
	additionalProperties: false,
}
const v_validateOrderFieldsScheme = ajv.compile(s_validateOrderFieldsScheme)

export const validateOrderFieldsScheme = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateOrderFieldsScheme, body)
}
