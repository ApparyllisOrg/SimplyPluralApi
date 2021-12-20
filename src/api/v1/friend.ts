import { Request, Response } from "express";
import { publishDbEvent } from "../../modules/dispatcher/dispatch";
import { db, getCollection } from "../../modules/mongo";
import { OperationType } from "../../modules/socket";
import { fetchCollection, sendDocument, sendDocuments, transformResultForClientRead } from "../../util";
import { validateSchema } from "../../util/validation";


export const getFriend = async (req: Request, res: Response) => {
	const document = await db.findDocument("friends", { uid: res.locals.uid, friendUuid: req.params.id });
	sendDocument(req, res, "friends", document);
}

export const getFriends = async (req: Request, res: Response) => {
	fetchCollection(req, res, "friends");
}

export const getIngoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("friendRequests").find({ receiver: res.locals.uid }).toArray();
	sendDocuments(req, res, "friendRequests", documents);
}

export const getOutgoingFriendRequests = async (req: Request, res: Response) => {
	const documents = await getCollection("friendRequests").find({ sender: res.locals.uid }).toArray();
	sendDocuments(req, res, "friendRequests", documents);
}

export const updateFriend = async (req: Request, res: Response) => {
	const result = await getCollection("friends").updateOne({ uid: res.locals.uid, friendUuid: req.params.id, lastUpdate: { $le: res.locals.operationTime } }, { $set: req.body })
	if (result.result.n === 0) {
		res.status(404).send();
		return;
	}
	else {
		publishDbEvent({ uid: res.locals.uid, documentId: req.params.id, collection: "friends", operationType: OperationType.Update });
	}
	res.status(200).send();
}

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

					const result = transformResultForClientRead(front, res.locals.uid);
					friendFrontValues.push(result);

				}
			}
			else {
				const front = await sharedFront.findOne({ uid: friendSettingsDoc.uid, _id: friendSettingsDoc.uid });
				if (front) {
					const result = transformResultForClientRead(front, res.locals.uid);
					friendFrontValues.push(result);
				}
			}
		}
	}

	// TODO: Only send uid, frontString and customFrontString
	res.status(200).send({ "results": friendFrontValues });
};

export const getFriendFront = async (req: Request, res: Response) => {
	const friendFronts = await db.getMultiple({ uid: req.params.id }, req.params.id, "front").toArray();

	//TODO: Remove startTime and uuid, basically only send a list of document ids
	sendDocuments(req, res, "front", friendFronts);
};

export const validatePatchFriendSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			seeMembers: { type: "boolean" },
			seeFront: { type: "boolean" },
			getFrontNotif: { type: "boolean" },
			trusted: { type: "boolean" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}