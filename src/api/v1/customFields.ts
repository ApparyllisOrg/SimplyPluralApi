import assert from "assert"
import { getCollection, parseId } from "../../modules/mongo"
import { fetchSimpleDocument, fetchCollection, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchBucketsForFriend, fetchCollectionPermissionsPreflighted } from "../../util"
import { Request, Response } from "express"
import { ajv, validateSchema } from "../../util/validation"
import { ObjectId } from "mongodb"
import { DiffProcessor } from "../../util/diff"
import { Diff } from "deep-diff"
import { insertDefaultPrivacyBuckets } from "./privacy/privacy.assign.defaults"
import { canSeeMembers, getFriendLevel, isTrustedFriend } from "../../security"
import { doesUserHaveVersion, FIELD_MIGRATION_VERSION } from "./user/updates/updateUser"

export const NewFieldsVersion = 300

export interface CustomFieldType {
	_id: string | ObjectId
	name: string
	order: number
	privacyBuckets: ObjectId[]
	type: number
}

export const getCustomField = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "customFields")
}

export const getCustomFields = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid)
		if (!canSee) {
			res.status(403).send("You are not authorized to see content of this user")
			return
		}

		const userMigrated = await doesUserHaveVersion(req.params.system, FIELD_MIGRATION_VERSION)
		if (userMigrated) {
			const friendBuckets = await fetchBucketsForFriend(res.locals.uid, req.params.system)
			fetchCollectionPermissionsPreflighted(req, res, "customFields", { buckets: { $in: friendBuckets } })
		} else {
			// If user did not yet migrate transform legacy fields into up-to-date format fields so that newer app versions can fetch custom fields of legacy accounts

			const friendUser = await getCollection("users").findOne({ uid: req.params.system, _id: req.params.system })
			const legacyFriendFields:
				| undefined
				| {
						[key: string]: {
							name: string
							order: number | string
							private: boolean
							preventTrusted: boolean
							type: number
						}
				  } = friendUser.fields

			const friendLevel = await getFriendLevel(req.params.system, res.locals.uid)
			const isATrustedFriends = isTrustedFriend(friendLevel)

			const friendMigrated = await doesUserHaveVersion(res.locals.uid, FIELD_MIGRATION_VERSION)

			const transformedForClientReadFields: any[] = []

			if (legacyFriendFields) {
				Object.keys(legacyFriendFields).forEach((key: string) => {
					const field = legacyFriendFields[key]
					if (field.private === true && field.preventTrusted === false && isATrustedFriends) {
						const newField = field

						if (friendMigrated === true) {
							newField.order = field.order.toString()
						}

						transformedForClientReadFields.push({ id: key, exists: true, content: newField })
					}

					if (field.private === false && field.preventTrusted === false) {
						const newField = field

						if (friendMigrated === true) {
							newField.order = field.order.toString()
						}

						transformedForClientReadFields.push({ id: key, exists: true, content: newField })
					}
				})
			}

			res.status(200).send(transformedForClientReadFields)
		}
	} else {
		if (!req.query.sortBy && !req.query.sortOrder) {
			req.query.sortBy = "order"
			req.query.sortOrder = "1"
		}
		fetchCollection(req, res, "customFields", {})
	}
}

export const addCustomField = async (req: Request, res: Response) => {
	const insertBuckets = async (data: any): Promise<void> => {
		await insertDefaultPrivacyBuckets(res.locals.uid, data, "customFields")
	}

	await addSimpleDocument(req, res, "customFields", insertBuckets)
}

export const updateCustomField = async (req: Request, res: Response) => {
	const differenceProcessor: DiffProcessor = async (uid: string, difference: Diff<any, any>, lhs: any, rhs: any) => {
		if (difference.path![0] === "order") {
			return { processed: true, result: undefined, ignore: true }
		}

		return { processed: false, result: undefined }
	}

	updateSimpleDocument(req, res, "customFields", differenceProcessor)
}

export const deleteCustomField = async (req: Request, res: Response) => {
	assert(req.params.id)

	const fieldName = `info.${req.params.id}`

	await getCollection("members").updateMany({ uid: res.locals.uid }, { $unset: { [fieldName]: "" } })

	deleteSimpleDocument(req, res, "customFields")
}

const s_validatePostCustomFieldSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		type: { type: "number" },
		order: { type: "string", pattern: "^0|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
		supportMarkdown: { type: "boolean" },
	},
	required: ["name", "supportMarkdown", "type", "order"],
	nullable: false,
	additionalProperties: false,
}
const v_validatePostCustomFieldSchema = ajv.compile(s_validatePostCustomFieldSchema)

export const validatePostCustomFieldSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostCustomFieldSchema, body)
}

const s_validatePatchCustomFieldSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		type: { type: "number" },
		order: { type: "string", pattern: "^0|[a-z0-9]{6,}:[a-z0-9]{0,}$" },
		supportMarkdown: { type: "boolean" },
	},
	required: [],
	nullable: false,
	additionalProperties: false,
}
const v_validatePatchCustomFieldSchema = ajv.compile(s_validatePatchCustomFieldSchema)

export const validatePatchCustomFieldSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePatchCustomFieldSchema, body)
}
