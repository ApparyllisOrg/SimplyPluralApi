import { Request, Response } from "express";
import moment from "moment";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { canSeeMembers, getFriendLevel, isTrustedFriend } from "../../security";
import { addSimpleDocument, deleteSimpleDocument, fetchCollection, fetchSimpleDocument, getDocumentAccess, sendDocument, sendQuery, transformResultForClientRead, updateSimpleDocument } from "../../util";
import { ajv, getAvatarUuidSchema, getPrivacyDependency, validateSchema } from "../../util/validation";
import { frameType } from "../types/frameType";
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./user/updates/updateUser";
import { CustomFieldType } from "./customFields";
import { Diff } from "deep-diff";
import { DiffProcessor, DiffResult } from "../../util/diff";
import { limitStringLength } from "../../util/string";
import { ObjectId } from "mongodb";
import { Transform } from "stream";
import { insertDefaultPrivacyBuckets } from "./privacy/privacy.assign.defaults";

export const filterFieldsForPrivacy = async (req: Request, res: Response, uid: string, members: any[]) : Promise<void> => 
{
	const hasMigrated = await doesUserHaveVersion(uid, FIELD_MIGRATION_VERSION)
	if (hasMigrated)
	{
		const userFields = await getCollection("customFields").find({uid}).toArray()

		const allowedFields : CustomFieldType[] = []

		for (let i = 0; i < userFields.length; ++i)
		{
			const field = userFields[i]
			const accessResult = await getDocumentAccess(res.locals.uid, field, "customFields")

			if (accessResult.access === true)
			{
				allowedFields.push(field)
			}
		}

		members.forEach((member) => {
			if (member.info)
			{
				const newFields: any = {}

				allowedFields.forEach((field) => 
				{
					newFields[field._id.toString()] = member.info[field._id.toString()]
				})

				member.info = newFields;
			}
		})
	}
	else // Legacy custom fields
	{
		const ownerUser = await getCollection("users").findOne({ _id: uid , uid });

		if (ownerUser)
		{
			const friendLevel = await getFriendLevel(uid, res.locals.uid);
			const isATrustedFriend = isTrustedFriend(friendLevel);
	
			const ownerFields: { [key: string]: any } = ownerUser.fields;
			members.forEach((member) => {

				const newFields: any = {};
				
				if (member.info && ownerFields) {
					Object.keys(member.info).forEach((key) => {
						const fieldSpec = ownerFields[key];
						if (fieldSpec) {
							if (fieldSpec.private === true && fieldSpec.preventTrusted === false && isATrustedFriend) {
								newFields[key] = member.info[key] ?? "";
							}
							if (fieldSpec.private === false && fieldSpec.preventTrusted === false) {
								newFields[key] = member.info[key] ?? "";
							}
						}
					});
				}

				member.info = newFields;
			});
		}
	}
}

export const getMembers = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid);
		if (!canSee) {
			res.status(403).send("You are not authorized to see content of this user");
			return;
		}
	}

	if (req.params.system != res.locals.uid)
	{
		const query = getCollection("members").find({ uid: req.params.system });

		const parseDocument = async (chunk: any) => 
		{
			chunk = await filterFieldsForPrivacy(req, res, req.params.system, [chunk])
			return true
		}
	
		sendQuery(req, res, "members", query.stream(), parseDocument);
	}
	else // Send to ourselves, bypass all checks
	{
		fetchCollection(req, res, "members", { uid: req.params.system })
	}
};

export const get = async (req: Request, res: Response) => {

	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid);
		if (!canSee) {
			res.status(403).send("You are not authorized to see content of this user");
			return;
		}
	}

	const document = await getCollection("members").findOne({ _id: parseId(req.params.id), uid: req.params.system ?? res.locals.uid });

	if (!document)
	{
		res.status(404).send()
		return
	}

	if (req.params.system != res.locals.uid) {

		await filterFieldsForPrivacy(req, res, req.params.system, [document])
	}

	sendDocument(req, res, "members", document);
};

export const add = async (req: Request, res: Response) => {

	const insertBuckets = async (data: any) : Promise<void> =>
	{
		await insertDefaultPrivacyBuckets(res.locals.uid, data, 'members')
	}

	addSimpleDocument(req, res, "members", insertBuckets);
};

const updateDiffProcessor : DiffProcessor = async (uid: string, difference: Diff<any, any>, lhs: any, rhs: any) =>
{
	if (difference.kind === "E" && difference.path![0] === "info")
	{
		const fieldId = difference.path![1]
		const field = await getCollection("customFields").findOne({uid, _id: parseId(fieldId)})

		if (field)
		{
			const originalValue = difference.lhs
			return { processed: true, result: {o: originalValue, n: limitStringLength(difference.rhs, 50, true) ?? '', p: field.name, cn: true}}	
		}
	}

	if (difference.kind === "N" && difference.path![0] === "info" && difference.path?.length === 1)
	{
		const newFields = difference.rhs;
		const newFieldsKeys = Object.keys(newFields);

		const newInfo : DiffResult[] = []

		for (let i = 0; i < newFieldsKeys.length; ++i)
		{
			const newFieldValue : string = newFields[newFieldsKeys[i]]
			if (newFieldValue && newFieldValue.length > 0)
			{
				const fieldId = parseId(newFieldsKeys[i])
				const field = await getCollection("customFields").findOne({uid, _id: fieldId})
				newInfo.push({o: "", n: limitStringLength(newFieldValue, 50, true) ?? '', p: field.name, cn: true})
			}
		}

		return {processed: true, result: newInfo}
	}

	return {processed: false, result: undefined}
}

export const update = async (req: Request, res: Response) => {

	// If user passes in info, but we migrated to FIELD_MIGRATION_VERSION we need to reject this, as 1.11+ has its own dedicated fields update route
	if (!!req.body.info)
	{
		const hasMigrated = await doesUserHaveVersion(res.locals.uid, FIELD_MIGRATION_VERSION)
		if (hasMigrated)
		{
			delete req.body.info 
		}
	}

	updateSimpleDocument(req, res, "members", updateDiffProcessor);

	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });
	if (fhLive) {
		frontChange(res.locals.uid, false, req.params.id, false);
	}
};

export const updateInfo = async (req: Request, res: Response) => {

	const hasMigrated = await doesUserHaveVersion(res.locals.uid, FIELD_MIGRATION_VERSION)
	if (!hasMigrated)
	{
		res.status(400).send("This route is only available for users who have updated to 1.11")
		return
	}

	const userFields = await getCollection("customFields").find({uid: res.locals.uid}).toArray()

	let infoFieldsKeys = Object.keys(req.body.info);
	infoFieldsKeys = infoFieldsKeys.filter((fieldKey) => userFields.findIndex((userField) => {
		const userFieldId = parseId(userField._id);
		const infoFieldId = parseId(fieldKey);

		if (ObjectId.isValid(userFieldId) && ObjectId.isValid(infoFieldId))
		{
			return (infoFieldId as ObjectId).equals(userFieldId)
		}

		return false;
	}) !== -1)

	const originalBody = req.body.info

	req.body = {}

	infoFieldsKeys.forEach((fieldKey) =>
	{
		req.body[`info.${fieldKey}`] = originalBody[fieldKey];
	})
	
	updateSimpleDocument(req, res, "members", updateDiffProcessor);
};

export const del = async (req: Request, res: Response) => {
	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });

	// Delete live fronts of this member
	await getCollection("frontHistory").updateOne({ uid: res.locals.uid, member: req.params.id, live: true }, { $set: { live: false, endTime: moment.now() } });

	if (fhLive) {
		frontChange(res.locals.uid, true, req.params.id, false);
	}

	// Delete this member from any groups they're in
	getCollection("groups")
		.find({ uid: res.locals.uid })
		.forEach((group: any) => {
			const members: string[] = group.members ?? [];
			const newMembers = members.filter((member) => member != req.params.id);
			getCollection("groups").updateOne({ uid: res.locals.uid, _id: parseId(group._id) }, { $set: { members: newMembers } });
		});

	// @ts-ignore
	getCollection("groups").updateMany({ uid: res.locals.uid }, { $pull: { members: req.params.id } });

	// Delete notes that belong to this member
	getCollection("notes").deleteMany({ uid: res.locals.uid, member: req.params.id });

	// Delete board messages that are for to this member
	getCollection("boardMessages").deleteMany({ uid: res.locals.uid, writtenFor: req.params.id });

	deleteSimpleDocument(req, res, "members");
};

const s_validateMemberSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		desc: { type: "string" },
		pronouns: { type: "string" },
		pkId: { type: "string" },
		color: { type: "string" },
		avatarUuid: { type: "string" },
		avatarUrl: { type: "string" },
		private: { type: "boolean" },
		preventTrusted: { type: "boolean" },
		preventsFrontNotifs: { type: "boolean" },
		info: {
			type: "object",
			properties: {
				"*": { type: "string" },
			},
		},
		supportDescMarkdown: { type: "boolean" },
		archived: { type: "boolean" },
		receiveMessageBoardNotifs: { type: "boolean" },
		archivedReason: { type: "string", maxLength: 150 },
		frame: frameType

	},
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
};
const v_validateMemberSchema = ajv.compile(s_validateMemberSchema)

export const validateMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateMemberSchema, body);
};

const s_validatePostMemberSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		desc: { type: "string" },
		pronouns: { type: "string" },
		pkId: { type: "string" },
		color: { type: "string" },
		avatarUuid: getAvatarUuidSchema(),
		avatarUrl: { type: "string" },
		private: { type: "boolean" },
		preventTrusted: { type: "boolean" },
		preventsFrontNotifs: { type: "boolean" },
		info: {
			type: "object",
			properties: {
				"*": { type: "string" },
			},
		},
		supportDescMarkdown: { type: "boolean" },
		archived: { type: "boolean" },
		receiveMessageBoardNotifs: { type: "boolean" },
		archivedReason: { type: "string", maxLength: 150 },
		frame: frameType
	},
	required: ["name"],
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
};
const v_validatePostMemberSchema = ajv.compile(s_validatePostMemberSchema)

export const validatePostMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostMemberSchema, body);
};

const s_validateUpdateMemberFieldsSchema = {
	type: "object",
	properties: {
		info: {
			type: "object",
			properties: {
				"*": { type: "string" },
			},
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["info"]
};
const v_validateUpdateMemberFieldsSchema = ajv.compile(s_validateUpdateMemberFieldsSchema)

export const validateUpdateMemberFieldsSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateUpdateMemberFieldsSchema, body);
};