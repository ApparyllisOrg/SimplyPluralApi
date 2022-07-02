import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { FriendLevel, getFriendLevel } from "../../../security";
import { notifyUser } from "../../../util";
import { SimplyPluralDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";

// Todo: Add schema
export const AddFriend = async (req: Request, res: Response) => {
	const target = req.params.id;

	const userDoc = await getCollection("users", SimplyPluralDb).findOne({
		$or: [{ username: { $regex: "^" + target + "$", $options: "i" } }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(200).send({ success: false, msg: "User not found" });
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
		const pendingDoc = await getCollection("pendingFriendRequests", SimplyPluralDb).findOne({
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

	const { seeMembers, seeFront, getFrontNotif, trusted } = req.body.settings;

	await getCollection("pendingFriendRequests", SimplyPluralDb).insertOne({
		sender: res.locals.uid,
		receiver: targtUid,
		seeMembers: seeMembers,
		seeFront: seeFront,
		getFrontNotif: getFrontNotif,
		trusted: trusted,
	});

	const selfDoc = await getCollection("users", SimplyPluralDb).findOne({ uid: res.locals.uid });

	if (selfDoc) {
		notifyUser(targtUid, "Friend request received", selfDoc.username, SimplyPluralDb);
	}

	res.status(200).send({ success: true, msg: "Friend request sent" });
};

export const validateRespondToFrienqRequestSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			accept: { type: "boolean" },
			settings: {
				type: "object",
				properties: {
					seeMembers: { type: "boolean" },
					seeFront: { type: "boolean" },
					getFrontNotif: { type: "boolean" },
					trusted: { type: "boolean" }
				},
				nullable: false,
				additionalProperties: false,
			},
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const RespondToFriendRequest = async (req: Request, res: Response) => {
	const accept = req.query.accepted === "true";
	const target = req.params.id;

	const userDoc = await getCollection("users", SimplyPluralDb).findOne({
		$or: [{ username: `^${target}$` }, { uid: target }],
	});

	if (userDoc === null) {
		res.status(200).send({ success: false, msg: "User not found" });
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

	res.status(200).send({ success: false, msg: "No pending friend requests with this user" });
};

export const AcceptFriendRequest = async (_sender: string, _receiver: string, accepted: boolean, settings: any) => {
	const requestDoc = await getCollection("pendingFriendRequests", SimplyPluralDb).findOne({ receiver: _receiver, sender: _sender });
	// Delete the request
	if (requestDoc !== null) {
		getCollection("pendingFriendRequests", SimplyPluralDb).deleteOne({ _id: requestDoc._id });

		if (accepted) {
			const selfDoc = await getCollection("users", SimplyPluralDb).findOne({ uid: _receiver });
			notifyUser(_sender, "Friend request accepted", selfDoc.username, SimplyPluralDb);
			{
				const { seeMembers, seeFront, getFrontNotif, trusted } = settings;
				await getCollection("friends", SimplyPluralDb).insertOne({
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

				await getCollection("friends", SimplyPluralDb).insertOne({
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

	const userDoc = await getCollection("users", SimplyPluralDb)
		.findOne({
			$or: [{ username: `^${target}$` }, { uid: target }],
		});

	if (userDoc === null) {
		res.status(200).send({ success: false, msg: "User not found" });
		return;
	}

	const targtUid = userDoc.uid;

	const pendingDoc = await getCollection("pendingFriendRequests", SimplyPluralDb)
		.findOne({
			$or: [{ sender: res.locals.uid, receiver: targtUid }],
		});

	if (pendingDoc !== null) {
		getCollection("pendingFriendRequests", SimplyPluralDb)
			.deleteOne({
				$or: [{ sender: res.locals.uid, receiver: targtUid }],
			});
		res.status(200).send({ success: true, msg: "Friend request cancelled" });
		return;
	}

	res.status(200).send({ success: false, msg: "You don't have any pending friend requests with this user" });
};

export const RemoveFriend = async (req: Request, res: Response) => {
	const target = req.params.id;

	const userDoc = await getCollection("users", SimplyPluralDb)
		.findOne({
			$or: [{ username: `^${target}$` }, { uid: target }],
		});

	if (userDoc === null) {
		res.status(200).send({ success: false, msg: "User not found" });
		return;
	}

	const targtUid = userDoc.uid;

	await getCollection("friends", SimplyPluralDb)
		.deleteMany({
			$or: [
				{ uid: res.locals.uid, frienduid: targtUid },
				{ uid: targtUid, frienduid: res.locals.uid },
			],
		});

	res.status(200).send({ success: true, msg: "Friend removed" });
};