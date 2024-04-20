import { Request, Response } from "express";
import moment from "moment";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { canSeeMembers, getFriendLevel, isTrustedFriend } from "../../security";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, getDocumentAccess, sendDocument, sendDocuments, updateSimpleDocument } from "../../util";
import { getPrivacyDependency, validateSchema } from "../../util/validation";
import { frameType } from "../types/frameType";
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./user/updates/updateUser";
import { CustomFieldType } from "./customFields";

const filterFieldsForPrivacy = async (req: Request, res: Response, uid: string, members: any[]) : Promise<boolean> => 
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

	return true
}

export const getMembers = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid);
		if (!canSee) {
			res.status(403).send("You are not authorized to see members of this user");
			return;
		}
	}

	const query = getCollection("members").find({ uid: req.params.system });
	const documents = await query.toArray();

	if (req.params.system != res.locals.uid) {

		const filterResult = await filterFieldsForPrivacy(req, res, req.params.system, documents)
		if (filterResult !== true)
		{
			return
		}
	}

	sendDocuments(req, res, "members", documents);
};

export const get = async (req: Request, res: Response) => {

	const document = await getCollection("members").findOne({ _id: parseId(req.params.id), uid: req.params.system ?? res.locals.uid });

	if (req.params.system != res.locals.uid) {

		const filterResult = await filterFieldsForPrivacy(req, res, req.params.system, [document])
		if (filterResult !== true)
		{
			return
		}
	}

	sendDocument(req, res, "members", document);
};

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "members");
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "members");

	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });
	if (fhLive) {
		frontChange(res.locals.uid, false, req.params.id, false);
	}
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

export const validateMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
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

	return validateSchema(schema, body);
};

export const validatePostMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
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
		required: ["name", "private", "preventTrusted"],
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};
