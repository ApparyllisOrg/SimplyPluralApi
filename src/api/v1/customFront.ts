import { Request, Response } from "express"
import moment from "moment"
import { frontChange } from "../../modules/events/frontChange"
import { getCollection } from "../../modules/mongo"
import { canSeeMembers } from "../../security"
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument, fetchBucketsForFriend, fetchCollectionPermissionsPreflighted } from "../../util"
import { ajv, getPrivacyDependency, validateSchema, getAvatarUuidSchema } from "../../util/validation"
import { frameType } from "../types/frameType"
import { insertDefaultPrivacyBuckets } from "./privacy/privacy.assign.defaults"
import { doesUserHaveVersion, FIELD_MIGRATION_VERSION } from "./user/updates/updateUser"

export const getCustomFronts = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid)
		if (!canSee) {
			res.status(403).send("You are not authorized to see custom fronts of this user")
			return
		}

		const userMigrated = await doesUserHaveVersion(req.params.system, FIELD_MIGRATION_VERSION)
		if (userMigrated) {
			const friendBuckets = await fetchBucketsForFriend(res.locals.uid, req.params.system)
			fetchCollectionPermissionsPreflighted(req, res, "frontStatuses", { buckets: { $in: friendBuckets } })
		} else {
			fetchCollection(req, res, "frontStatuses", {})
		}
	} else {
		fetchCollection(req, res, "frontStatuses", {})
	}
}

export const get = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid)
		if (!canSee) {
			res.status(403).send("You are not authorized to see content of this user")
			return
		}
	}

	fetchSimpleDocument(req, res, "frontStatuses")
}

export const add = async (req: Request, res: Response) => {
	const insertBuckets = async (data: any): Promise<void> => {
		await insertDefaultPrivacyBuckets(res.locals.uid, data, "customFronts")
	}

	addSimpleDocument(req, res, "frontStatuses", insertBuckets)
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "frontStatuses")

	// If this cf is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true })
	if (fhLive) {
		frontChange(res.locals.uid, false, req.params.id, false)
	}
}

export const del = async (req: Request, res: Response) => {
	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true })

	await getCollection("frontHistory").updateOne({ uid: res.locals.uid, member: req.params.id, live: true }, { $set: { live: false, endTime: moment.now() } })

	if (fhLive) {
		frontChange(res.locals.uid, true, req.params.id, false)
	}

	deleteSimpleDocument(req, res, "frontStatuses")
}

const s_validateCustomFrontSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		desc: { type: "string" },
		avatarUrl: { type: "string" },
		avatarUuid: getAvatarUuidSchema(),
		color: { type: "string" },
		preventTrusted: { type: "boolean" },
		private: { type: "boolean" },
		supportDescMarkdown: { type: "boolean" },
		frame: frameType,
		preventsFrontNotifs: { type: "boolean" }
	},
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
}

const v_validateCustomFrontSchema = ajv.compile(s_validateCustomFrontSchema)

export const validateCustomFrontSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateCustomFrontSchema, body)
}

const s_validatePostCustomFrontSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		desc: { type: "string" },
		avatarUrl: { type: "string" },
		avatarUuid: getAvatarUuidSchema(),
		color: { type: "string" },
		preventTrusted: { type: "boolean" },
		private: { type: "boolean" },
		supportDescMarkdown: { type: "boolean" },
		frame: frameType,
		preventsFrontNotifs: { type: "boolean" }
	},
	required: ["name"],
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
}
const v_validatePostCustomFrontSchema = ajv.compile(s_validatePostCustomFrontSchema)

export const validatePostCustomFrontSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostCustomFrontSchema, body)
}
