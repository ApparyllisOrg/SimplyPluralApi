import { Request, Response } from "express";
import moment from "moment";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { canSeeMembers, getFriendLevel, isTrustedFriend } from "../../security";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, sendDocuments, updateSimpleDocument } from "../../util";
import { getPrivacyDependency, validateSchema } from "../../util/validation";

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
		const ownerUser = await getCollection("users").findOne({ uid: req.params.system });
		const friendLevel = await getFriendLevel(req.params.system, res.locals.uid);
		const isATrustedFriend = isTrustedFriend(friendLevel);
		if (ownerUser) {
			const ownerFields: { [key: string]: any } = ownerUser.fields;
			documents.forEach((member) => {
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
		} else {
			res.status(404).send();
			return;
		}
	}
	sendDocuments(req, res, "members", documents);
};

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "members");
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

	// Commented out due to typescript/mongodb error
	//getCollection("groups").updateMany({ uid: res.locals.uid }, { $pull: { members: req.params.id } });

	// Delete notes that belong to this member
	getCollection("notes").deleteMany({ uid: res.locals.uid, member: req.params.id });

	deleteSimpleDocument(req, res, "members");
};

export const validateMemberSchema = (body: any): { success: boolean; msg: string } => {
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
		},
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};

export const validatePostMemberSchema = (body: any): { success: boolean; msg: string } => {
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
		},
		required: ["name", "private", "preventTrusted"],
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};
