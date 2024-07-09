import { Request, Response } from "express";
import { userNotFound } from "../../modules/messages";
import { getCollection } from "../../modules/mongo";
import { notifyUser } from "../../modules/notifications/notifications";
import { FriendLevel, getFriendLevel } from "../../security";

import { ajv, validateSchema } from "../../util/validation";
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./user/updates/updateUser";

// Todo: Add schema
export const AddFriend = async (req: Request, res: Response) => {
	const target = req.params.usernameOrId;

	const userDoc = await getCollection("users").findOne({
		$or: [{ username: { $regex: "^" + target + "$", $options: "i" } }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(404).send({ success: false, msg: userNotFound() });
		return;
	}

	const targtUid = userDoc.uid;

	if (targtUid == res.locals.uid) {
		res.status(200).send({ success: false, msg: "You can't add yourselves :)" });
		return;
	}

	const friendLevel = await getFriendLevel(targtUid, res.locals.uid);
	if (friendLevel & FriendLevel.Friends) {
		res.status(200).send({ success: false, msg: "Already a friend with this user" });
		return;
	}

	if (friendLevel & FriendLevel.Pending) {
		const pendingDoc = await getCollection("pendingFriendRequests").findOne({
			$or: [{ sender: res.locals.uid, receiver: targtUid }],
		});
		if (pendingDoc !== null) {
			res.status(200).send({ success: false, msg: "Already have a pending friend request with this user" });
		} else {
			AcceptFriendRequest(targtUid, res.locals.uid, true, req.body.settings);
			res.status(200).send({ success: true, msg: "Friend added" });
		}

		return;
	}

	const { seeMembers, seeFront, getFrontNotif, trusted, message } = req.body.settings;

	await getCollection("pendingFriendRequests").insertOne({
		sender: res.locals.uid,
		receiver: targtUid,
		seeMembers: seeMembers,
		seeFront: seeFront,
		getFrontNotif: getFrontNotif,
		trusted: trusted,
		message: message,
	});

	const selfDoc = await getCollection("users").findOne({ uid: res.locals.uid });

	if (selfDoc) {
		notifyUser(userDoc["uid"], targtUid, "Friend request received", selfDoc.username);
	}

	res.status(200).send({ success: true, msg: "Friend request sent" });
};

const s_validateAddFrienqRequestSchema = {
	type: "object",
	properties: {
		settings: {
			type: "object",
			properties: {
				seeMembers: { type: "boolean" },
				seeFront: { type: "boolean" },
				getFrontNotif: { type: "boolean" },
				trusted: { type: "boolean" },
				message: { type: "string" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["seeMembers", "seeFront", "getFrontNotif", "trusted"],
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["settings"],
};
const v_validateAddFrienqRequestSchema = ajv.compile(s_validateAddFrienqRequestSchema)

export const validateAddFrienqRequestSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateAddFrienqRequestSchema, body);
};



const s_validatAddFrienqRequestV2Schema = {
	type: "object",
	properties: {
		settings: {
			type: "object",
			properties: {
				seeMembers: { type: "boolean" },
				seeFront: { type: "boolean" },
				getFrontNotif: { type: "boolean" },
				message: { type: "string" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["seeMembers", "seeFront", "getFrontNotif"],
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["settings"],
};
const v_validatAddFrienqRequestV2Schema = ajv.compile(s_validatAddFrienqRequestV2Schema)

export const validatAddFrienqRequestV2Schema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatAddFrienqRequestV2Schema, body);
};

const s_validateRespondToFrienqRequestSchema = {
	type: "object",
	properties: {
		settings: {
			type: "object",
			properties: {
				seeMembers: { type: "boolean" },
				seeFront: { type: "boolean" },
				getFrontNotif: { type: "boolean" },
				trusted: { type: "boolean" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["seeMembers", "seeFront", "getFrontNotif", "trusted"],
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["settings"],
};
const v_validateRespondToFrienqRequestSchema = ajv.compile(s_validateRespondToFrienqRequestSchema)

export const validateRespondToFrienqRequestSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateRespondToFrienqRequestSchema, body);
}

const s_validateRespondToFrienqRequestQuerySchema = {
	type: "object",
	properties: {
		accepted: {
			type: "string",
			pattern: "^(true|false)$",
		},
	},
	required: ["accepted"],
	nullable: false,
	additionalProperties: false,
};
const v_validateRespondToFrienqRequestQuerySchema = ajv.compile(s_validateRespondToFrienqRequestQuerySchema)

export const validateRespondToFrienqRequestQuerySchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateRespondToFrienqRequestQuerySchema, body);
};

const s_validateRespondToFrienqRequestV2Schema = {
	type: "object",
	properties: {
		settings: {
			type: "object",
			properties: {
				seeMembers: { type: "boolean" },
				seeFront: { type: "boolean" },
				getFrontNotif: { type: "boolean" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["seeMembers", "seeFront", "getFrontNotif"],
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["settings"],
};
const v_validateRespondToFrienqRequestV2Schema = ajv.compile(s_validateRespondToFrienqRequestV2Schema)

export const validateRespondToFrienqRequestV2Schema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateRespondToFrienqRequestV2Schema, body);
};

export const RespondToFriendRequest = async (req: Request, res: Response) => {
	const accept = req.query.accepted === "true";

	if (accept) {
		const migrated = await doesUserHaveVersion(res.locals.uid, FIELD_MIGRATION_VERSION)

		if (migrated)
		{
			const validation = validateRespondToFrienqRequestV2Schema(req.body);
			if (!validation.success) {
				res.status(400).send(validation.msg);
				return;
			}
		}
		else 
		{
			const validation = validateRespondToFrienqRequestSchema(req.body);
			if (!validation.success) {
				res.status(400).send(validation.msg);
				return;
			}
		}
		
	}

	const target = req.params.usernameOrId;

	const userDoc = await getCollection("users").findOne({
		$or: [{ username: `^${target}$` }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(404).send({ success: false, msg: userNotFound() });
		return;
	}

	const targtUid = userDoc.uid;

	const friendLevel = await getFriendLevel(targtUid, res.locals.uid);
	if (friendLevel & FriendLevel.Friends) {
		res.status(200).send({ success: false, msg: "Already a friend with this user" });
		return;
	}

	if (friendLevel & FriendLevel.Pending) {
		await AcceptFriendRequest(targtUid, res.locals.uid, accept, req.body.settings);
		res.status(200).send({ success: true, msg: accept ? "Friend request accepted" : "Friend request rejected" });
		return;
	}

	res.status(404).send({ success: false, msg: "No pending friend requests with this user" });
};

export const AcceptFriendRequest = async (_sender: string, _receiver: string, accepted: boolean, settings: any) => {
	const requestDoc = await getCollection("pendingFriendRequests").findOne({ receiver: _receiver, sender: _sender });
	// Delete the request
	if (requestDoc !== null) {
		getCollection("pendingFriendRequests").deleteOne({ _id: requestDoc._id });

		if (accepted) {
			const selfDoc = await getCollection("users").findOne({ uid: _receiver });
			notifyUser(_receiver, _sender, "Friend request accepted", selfDoc.username);
			{
				const { seeMembers, seeFront, getFrontNotif, trusted } = settings;
				await getCollection("friends").insertOne({
					uid: _receiver,
					frienduid: _sender,
					seeMembers: seeMembers,
					seeFront: seeFront,
					getFrontNotif: getFrontNotif,
					trusted: trusted,
				});
			}
			{
				let { seeMembers, seeFront, getFrontNotif, trusted } = requestDoc;

				seeMembers ??= false;
				seeFront = seeFront ?? false;
				getFrontNotif = getFrontNotif ?? false;
				trusted = trusted ?? false;

				await getCollection("friends").insertOne({
					uid: _sender,
					frienduid: _receiver,
					seeMembers: seeMembers,
					seeFront: seeFront,
					getFrontNotif: getFrontNotif,
					trusted: trusted,
				});
			}
		}
	}
};

export const CancelFriendRequest = async (req: Request, res: Response) => {
	const target = req.params.id;

	const userDoc = await getCollection("users").findOne({
		$or: [{ username: `^${target}$` }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(404).send({ success: false, msg: userNotFound() });
		return;
	}

	const targtUid = userDoc.uid;

	const pendingDoc = await getCollection("pendingFriendRequests").findOne({
		$or: [{ sender: res.locals.uid, receiver: targtUid }],
	});

	if (pendingDoc !== null) {
		getCollection("pendingFriendRequests").deleteOne({
			$or: [{ sender: res.locals.uid, receiver: targtUid }],
		});
		res.status(200).send({ success: true, msg: "Friend request cancelled" });
		return;
	}

	res.status(200).send({ success: false, msg: "You don't have any pending friend requests with this user" });
};

export const RemoveFriend = async (req: Request, res: Response) => {
	const target = req.params.id;

	const userDoc = await getCollection("users").findOne({
		$or: [{ username: `^${target}$` }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(404).send({ success: false, msg: userNotFound() });
		return;
	}

	const targtUid = userDoc.uid;

	await getCollection("friends").deleteMany({
		$or: [
			{ uid: res.locals.uid, frienduid: targtUid },
			{ uid: targtUid, frienduid: res.locals.uid },
		],
	});

	res.status(200).send({ success: true, msg: "Friend removed" });
};
