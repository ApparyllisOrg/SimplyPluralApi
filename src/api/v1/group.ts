import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { dispatchDelete, OperationType } from "../../modules/socket";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, isMemberOrCustomFront, isMember } from "../../util";
import { logDeleteAudit } from "../../util/diff";
import { ajv, getPrivacyDependency, validateSchema } from "../../util/validation";
import Ajv from "ajv";
import { insertDefaultPrivacyBuckets } from "./privacy/privacy.assign.defaults";

export const getGroups = async (req: Request, res: Response) => {
	fetchCollection(req, res, "groups", {});
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "groups");
};

export const add = async (req: Request, res: Response) => {
	const insertBuckets = async (data: any) : Promise<void> =>
	{
		await insertDefaultPrivacyBuckets(res.locals.uid, data, 'groups')
	}

	addSimpleDocument(req, res, "groups", insertBuckets);
};

export const setMemberInGroups = async (req: Request, res: Response) => {
	const member = req.body.member;
	const isAMember = await isMember(res.locals.uid, member);
	if (!isAMember) {
		res.status(404).send("Member does not exist");
		return;
	}

	const desiredGroups: string[] = req.body.groups;

	const groups = await getCollection("groups").find({ uid: res.locals.uid });

	await groups.forEach((document) => {
		let members: string[] | undefined = document.members;

		if (members === undefined) {
			members = [];
		}
		if (members !== undefined) {
			const includesMember = members.includes(member)

			let wantsToIncludeMember = false;
			for (let i = 0; i < desiredGroups.length; ++i) {
				const docId = parseId(document._id);
				const groupId = parseId(desiredGroups[i]);

				if (docId.toString() === groupId.toString()) {
					wantsToIncludeMember = true;
				}
			}

			if (wantsToIncludeMember !== includesMember) {

				if (wantsToIncludeMember) {
					getCollection("groups").updateOne({ uid: res.locals.uid, _id: parseId(document._id) }, { $push: { members: member } });
				}
				else {
					getCollection("groups").updateOne({ uid: res.locals.uid, _id: parseId(document._id) }, { $pull: { members: member } });
				}
			}
		}
	})

	res.status(200).send();
};

export const update = async (req: Request, res: Response) => {
	const group = await getCollection("groups").findOne({ uid: res.locals.uid, _id: parseId(req.params.id) });

	if (group) {
		// eslint-disable-next-line sonarjs/no-collapsible-if
		if (req.body.private === true && req.body.preventTrusted !== null) {
			let shouldRecursePrivacyUpdate = false
			if (!group.private && req.body.private === true)
			{
				shouldRecursePrivacyUpdate = true
			}
			if ((group.private && !group.preventTrusted) && req.body.preventTrusted)
			{
				shouldRecursePrivacyUpdate = true
			}
			if (shouldRecursePrivacyUpdate) {
				privateGroupRecursive(req.params.id, res.locals.uid, req.body.private, req.body.preventTrusted);
			}
		}

		updateSimpleDocument(req, res, "groups");
	} else {
		res.status(404).send("Cannot find specified group");
	}
};

export const del = async (req: Request, res: Response) => {
	const originalDocument = await getCollection("groups").findOne({ uid: res.locals.uid, _id: parseId(req.params.id) })
	if (!originalDocument)
	{
		res.status(404).send()
		return
	}

	await delGroupRecursive(req.params.id, res.locals.uid);

	//logDeleteAudit(res.locals.uid, "groups", res.locals.operationTime, originalDocument)

	res.status(200).send();
};

const delGroupRecursive = async (groupId: string, uid: string) => {
	const groups = await getCollection("groups").find({ uid, parent: groupId }).toArray();
	for (let i = 0; i < groups.length; i++) {
		await delGroupRecursive(groups[i]._id.toString(), uid);
	}
	await getCollection("groups").deleteOne({ uid, _id: parseId(groupId) });
	dispatchDelete({
		operationType: OperationType.Delete,
		uid,
		documentId: groupId,
		collection: "groups",
	});
};

const privateGroupRecursive = async (groupId: string, uid: string, priv: boolean, preventTrusted: boolean) => {
	const groups = await getCollection("groups").find({ uid, parent: groupId }).toArray();
	for (let i = 0; i < groups.length; i++) {
		await privateGroupRecursive(groups[i]._id.toString(), uid, priv, preventTrusted);
	}

	await getCollection("groups").updateOne({ uid, _id: parseId(groupId) }, { $set: { private: priv, preventTrusted } });
};

const s_validateGroupSchema = {
	type: "object",
	properties: {
		parent: { type: "string" },
		color: { type: "string" },
		private: { type: "boolean" },
		preventTrusted: { type: "boolean" },
		name: { type: "string" },
		desc: { type: "string" },
		emoji: { type: "string" },
		members: { type: "array", items: { type: "string" }, uniqueItems: true },
		supportDescMarkdown: { type: "boolean" },
	},
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
};
const v_validateGroupSchema = ajv.compile(s_validateGroupSchema)

export const validateGroupSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateGroupSchema, body);
};

const s_validateSetMemberInGroupSchema = {
	type: "object",
	properties: {
		member: { type: "string", pattern: "^[a-zA-Z0-9]{5,64}$" },
		groups: { type: "array", items: { type: "string", pattern: "^[a-zA-Z0-9]{20,64}$" }, uniqueItems: true },
	},
	nullable: false,
	additionalProperties: false,
	required: ["member", "groups"],
};
const v_validateSetMemberInGroupSchema = ajv.compile(s_validateSetMemberInGroupSchema)

export const validateSetMemberInGroupSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateSetMemberInGroupSchema, body);
};

const s_validatePostGroupSchema = {
	type: "object",
	properties: {
		parent: { type: "string" },
		color: { type: "string" },
		private: { type: "boolean" },
		preventTrusted: { type: "boolean" },
		name: { type: "string" },
		desc: { type: "string" },
		emoji: { type: "string" },
		members: { type: "array", items: { type: "string" }, uniqueItems: true },
		supportDescMarkdown: { type: "boolean" },
	},
	required: ["parent", "color", "name", "desc", "emoji", "members"],
	nullable: false,
	additionalProperties: false,
	dependencies: getPrivacyDependency(),
};
const v_validatePostGroupSchema = ajv.compile(s_validatePostGroupSchema)

export const validatePostGroupSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePostGroupSchema, body);
};
