import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { canAccessDocument } from "../../security";
import { sendDocument, sendDocuments } from "../../util";
import { validateSchema } from "../../util/validation";


export const getFriend = async (req: Request, res: Response) => {
	const document = await getCollection("friends").findOne({ uid: req.params.system, frienduid: req.params.id });
	sendDocument(req, res, "friends", document);
}

export const getFriends = async (req: Request, res: Response) => {
	const friends = await getCollection("friends").find({ uid: res.locals.uid }).toArray();
	const friendValues: any[] = []

	for (let i = 0; i < friends.length; ++i) {
		friendValues.push(await getCollection("users").findOne({ uid: friends[i].frienduid }))
	}

	// Send users as collection as we are sending user objects, not friend (requests)
	sendDocuments(req, res, "users", friendValues);
}

export const getIngoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("pendingFriendRequests").find({ receiver: res.locals.uid }).toArray();
	const friendValues: any[] = []

	for (let i = 0; i < documents.length; ++i) {
		friendValues.push(await getCollection("users").findOne({ uid: documents[i].sender }))
	}

	// Send users as collection as we are sending user objects, not friend (requests)
	sendDocuments(req, res, "users", friendValues);
}

export const getOutgoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("pendingFriendRequests").find({ sender: res.locals.uid }).toArray();
	const friendValues: any[] = []

	for (let i = 0; i < documents.length; ++i) {
		friendValues.push(await getCollection("users").findOne({ uid: documents[i].receiver }))
	}

	// Send users as collection as we are sending user objects, not friend (requests)
	sendDocuments(req, res, "users", friendValues);
}

export const updateFriend = async (req: Request, res: Response) => {
	const setBody = req.body
	setBody.lastOperationTime = res.locals.operationTime;
	const result = await getCollection("friends").updateOne({
		uid: res.locals.uid, frienduid: req.params.id, $or: [
			{ lastOperationTime: null },
			{ lastOperationTime: { $lte: res.locals.operationTime } }
		]
	}, { $set: setBody })
	if (result.result.n === 0) {
		res.status(404).send();
		return;
	}
	res.status(200).send();
}

export const getFiendFrontValues = async (req: Request, res: Response) => {
	const friends = getCollection("friends");

	const sharedFront = getCollection("sharedFront");
	const privateFront = getCollection("privateFront");

	const friendSettingsDoc = await friends.findOne({ "frienduid": res.locals.uid, uid: req.params.system });

	if (friendSettingsDoc.seeFront === true) {
		if (friendSettingsDoc.trusted === true) {
			const front = await privateFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
			res.status(200).send({ frontString: front.frontString, customFrontString: front.customFrontString });
		}
		else {
			const front = await sharedFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
			res.status(200).send({ frontString: front.frontString, customFrontString: front.customFrontString });
		}
	}

	res.status(404).send();
};


export const getAllFriendFrontValues = async (_req: Request, res: Response) => {
	const friends = getCollection("friends");

	const sharedFront = getCollection("sharedFront");
	const privateFront = getCollection("privateFront");

	const friendSettings = await friends.find({ "frienduid": res.locals.uid }).toArray();

	const friendFrontValues: any[] = [];

	for (let i = 0; i < friendSettings.length; ++i) {
		const friendSettingsDoc = friendSettings[i];

		if (friendSettingsDoc.seeFront === true) {
			if (friendSettingsDoc.trusted === true) {
				const front = await privateFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
				if (front) {
					friendFrontValues.push({ uid: front.uid, customFrontString: front.customFrontString, frontString: front.frontString });
				}
			}
			else {
				const front = await sharedFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
				if (front) {
					friendFrontValues.push({ uid: front.uid, customFrontString: front.customFrontString, frontString: front.frontString });
				}
			}
		}
	}

	// TODO: Only send uid, frontString and customFrontString
	res.status(200).send({ "results": friendFrontValues });
};

export const getFriendFront = async (req: Request, res: Response) => {
	const friendFronts = await getCollection("frontHistory").find({ uid: req.params.id, live: true }).toArray();

	const frontingList = []
	const frontingStatuses: { [key: string]: string } = {}

	for (let i = 0; i < friendFronts.length; ++i) {
		const { member, customStatus } = friendFronts[i]
		const memberDoc = await getCollection("members").findOne({ _id: parseId(member) });

		if (memberDoc) {
			const { preventTrusted } = memberDoc;

			const canAccess = await canAccessDocument(res.locals.uid, req.params.id, memberDoc.private, preventTrusted);
			if (canAccess === true) {
				frontingList.push(member);
				if (customStatus) {
					frontingStatuses[member] = customStatus;
				}
			}
		}
		const customFrontDoc = await getCollection("frontStatuses").findOne({ _id: parseId(member) });
		if (customFrontDoc) {
			const { preventTrusted } = customFrontDoc;

			const canAccess = await canAccessDocument(res.locals.uid, req.params.id, customFrontDoc.private, preventTrusted);
			if (canAccess === true) {
				frontingList.push(member);
				if (customStatus) {
					frontingStatuses[member] = customStatus;
				}
			}
		}
	}

	res.status(200).send({ fronters: frontingList, statuses: frontingStatuses });
};

export const validatePatchFriendSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			seeMembers: { type: "boolean" },
			seeFront: { type: "boolean" },
			getFrontNotif: { type: "boolean" },
			getTheirFrontNotif: { type: "boolean" },
			trusted: { type: "boolean" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}