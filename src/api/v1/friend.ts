import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { fetchCollection, getDocumentAccess, sendDocument, sendDocuments } from "../../util";
import { validateSchema } from "../../util/validation";
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./user/updates/updateUser";

export const getFriend = async (req: Request, res: Response) => {
	const document = await getCollection("friends").findOne({ uid: req.params.system, frienduid: req.params.id });
	sendDocument(req, res, "friends", document);
};

export const getFriends = async (req: Request, res: Response) => {
	const friends = await getCollection("friends").find({ uid: res.locals.uid }).toArray();
	const friendValues: any[] = [];

	for (let i = 0; i < friends.length; ++i) {
		const friend = await getCollection("users").findOne({ uid: friends[i].frienduid });
		if (friend) {
			friendValues.push(friend);
		}
	}

	// Send users as collection as we are sending user objects, not friend (requests)
	sendDocuments(req, res, "users", friendValues);
};

export const getFriendsSettings = async (req: Request, res: Response) => {
	fetchCollection(req, res, "friends", {})
};

export const getIngoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("pendingFriendRequests").find({ receiver: res.locals.uid }).toArray();
	const friendValues: any[] = [];

	for (let i = 0; i < documents.length; ++i) {
		const friend = await getCollection("users").findOne({ uid: documents[i].sender });
		if (friend) {
			const response = { message: documents[i].message, username: friend.username, uid: friend.uid, _id: friend._id };
			friendValues.push(response);
		}
	}

	// Send users as collection as we are sending user objects, not friend (requests)
	sendDocuments(req, res, "users", friendValues);
};

export const getOutgoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("pendingFriendRequests").find({ sender: res.locals.uid }).toArray();
	const friendValues: any[] = [];

	for (let i = 0; i < documents.length; ++i) {
		const friend = await getCollection("users").findOne({ uid: documents[i].receiver });
		if (friend) {
			const response = { message: documents[i].message, username: friend.username, uid: friend.uid, _id: friend._id };
			friendValues.push(response);
		}
	}

	sendDocuments(req, res, "users", friendValues);
};

export const updateFriend = async (req: Request, res: Response) => {
	const setBody = req.body;
	setBody.lastOperationTime = res.locals.operationTime;
	if (setBody["getTheirFrontNotif"] === true) {
		const friend = await getCollection("friends").findOne(
			{
				uid: req.params.id,
				frienduid: res.locals.uid
			}
		);
		if (friend && friend["getFrontNotif"] === false) {
			setBody["getTheirFrontNotif"] = false;
		}
	}
	const result = await getCollection("friends").updateOne(
		{
			uid: res.locals.uid,
			frienduid: req.params.id,
			$or: [{ lastOperationTime: null }, { lastOperationTime: { $lte: res.locals.operationTime } }],
		},
		{ $set: setBody }
	);
	if (result.modifiedCount === 0) {
		res.status(404).send();
		return;
	}
	if (setBody["getFrontNotif"] === false) {
		await getCollection("friends").updateOne(
			{
				uid: req.params.id,
				frienduid: res.locals.uid,
				$or: [{ lastOperationTime: null }, { lastOperationTime: { $lte: res.locals.operationTime } }],
			},
			{ $set: { "getTheirFrontNotif": false } }
		);
	}
	res.status(200).send();
};

export const getFriendFrontValues = async (req: Request, res: Response) => {
	const hasMigrated = await doesUserHaveVersion(req.params.id, FIELD_MIGRATION_VERSION)
	if (hasMigrated)
	{
		const friendDoc = await getCollection("friends").findOne({ uid: req.params.id, frienduid: res.locals.uid });
		if (!friendDoc)
		{
			res.status(404).send()
			return
		}

		const friendSettingsDoc = await getCollection("friends").findOne({ frienduid: res.locals.uid, uid: req.params.system });

		if (friendSettingsDoc.seeFront === true) {
			res.status(200).send({ frontString: friendDoc.frontString , customFrontString: friendDoc.customFrontString ?? "" });
		}
	
		return
	}

	// legacy support

	const friends = getCollection("friends");

	const sharedFront = getCollection("sharedFront");
	const privateFront = getCollection("privateFront");

	const friendSettingsDoc = await friends.findOne({ frienduid: res.locals.uid, uid: req.params.system });

	if (friendSettingsDoc.seeFront === true) {
		if (friendSettingsDoc.trusted === true) {
			const front = await privateFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
			res.status(200).send({ frontString: front?.frontString ?? "", customFrontString: front?.customFrontString ?? "" });
		} else {
			const front = await sharedFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
			res.status(200).send({ frontString: front?.frontString ?? "", customFrontString: front?.customFrontString ?? "" });
		}
	}

	res.status(404).send();
};

export const getAllFriendFrontValues = async (_req: Request, res: Response) => {
	const friends = getCollection("friends");

	const sharedFront = getCollection("sharedFront");
	const privateFront = getCollection("privateFront");

	const friendSettings = await friends.find({ frienduid: res.locals.uid }).toArray();

	const friendFrontValues: any[] = [];

	for (let i = 0; i < friendSettings.length; ++i) {
		const friendSettingsDoc = friendSettings[i];

		const hasMigrated = await doesUserHaveVersion(friendSettingsDoc.uid, FIELD_MIGRATION_VERSION)
		if (hasMigrated)
		{
			const friendDoc = await getCollection("friends").findOne({ uid: friendSettingsDoc.uid, frienduid: res.locals.uid });
			if (friendDoc)
			{
				if (friendSettingsDoc.seeFront === true) {
					friendFrontValues.push({ uid: friendDoc.uid, customFrontString: friendDoc.customFrontString, frontString: friendDoc.frontString });
				}
			}
		}
		else 
		{
			if (friendSettingsDoc.seeFront === true) {
				if (friendSettingsDoc.trusted === true) {
					const front = await privateFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
					if (front) {
						friendFrontValues.push({ uid: front.uid, customFrontString: front.customFrontString, frontString: front.frontString });
					}
				} else {
					const front = await sharedFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
					if (front) {
						friendFrontValues.push({ uid: front.uid, customFrontString: front.customFrontString, frontString: front.frontString });
					}
				}
			}
		}
	}

	res.status(200).send({ results: friendFrontValues });
};

export const getFriendFront = async (req: Request, res: Response) => {
	const friendFronts = await getCollection("frontHistory").find({ uid: req.params.id, live: true }).toArray();

	const frontingList = [];
	const frontingStatuses: { [key: string]: string } = {};

	for (let i = 0; i < friendFronts.length; ++i) {
		const { member, customStatus } = friendFronts[i];
		const memberDoc = await getCollection("members").findOne({ _id: parseId(member) });

		if (memberDoc) {
			const canAccess = await getDocumentAccess(res.locals.uid, memberDoc, "members");
			if (canAccess.access === true) {
				frontingList.push(member);
				if (customStatus) {
					frontingStatuses[member] = customStatus;
				}
			}
		}
		const customFrontDoc = await getCollection("frontStatuses").findOne({ _id: parseId(member) });
		if (customFrontDoc) {
			const canAccess = await getDocumentAccess(res.locals.uid, customFrontDoc, "frontStatuses");
			if (canAccess.access === true) {
				frontingList.push(member);
				if (customStatus) {
					frontingStatuses[member] = customStatus;
				}
			}
		}
	}

	res.status(200).send({ fronters: frontingList, statuses: frontingStatuses });
};

export const validatePatchFriendSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			seeMembers: { type: "boolean" },
			seeFront: { type: "boolean" },
			getFrontNotif: { type: "boolean" },
			getTheirFrontNotif: { type: "boolean" },
			trusted: { type: "boolean" },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};
