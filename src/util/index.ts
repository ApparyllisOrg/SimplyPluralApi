import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { messaging } from "firebase-admin";
import { ObjectID } from "mongodb";
import { publishDbEvent } from "../modules/dispatcher/dispatch";
import * as Mongo from "../modules/mongo";
import { db, parseId } from "../modules/mongo";
import { documentObject } from "../modules/mongo/baseTypes";
import { OperationType } from "../modules/socket";
import { FriendLevel, friendReadCollections, getFriendLevel, isFriend, isTrustedFriend } from "../security";
import { parseForAllowedReadValues } from "../security/readRules";

export function transformResultForClientRead(value: documentObject, requestorUid: string) {

	parseForAllowedReadValues(value, requestorUid);

	const { _id, ...other } = value;
	return {
		exists: true,
		id: _id,
		content: other,
	};
}

export const notifyUser = async (uid: string, title: string, message: string) => {
	const privateCollection = Mongo.db().collection("private");
	const privateFriendData = await privateCollection.findOne({ uid: uid });
	if (privateFriendData) {
		const token = privateFriendData["notificationToken"];
		if (Array.isArray(token)) {
			token.forEach((element) => {
				const payload = {
					notification: {
						title: title,
						body: message,
					},
					data: {
						title: title,
						body: message,
					},
					token: element,
				};

				messaging()
					.send(payload)
					.catch((error) => {
						if (error.code === "messaging/registration-token-not-registered") {
							privateCollection.updateOne({ uid: uid }, { $pull: { notificationToken: { element } } });
						} else if (error.code !== "messaging/internal-error") {
							Sentry.captureMessage("Error during notification: " + error);
						}
					});
			});
		}
	}
};

export const getDocumentAccess = async (req: Request, res: Response, document: documentObject, collection: string): Promise<{ access: boolean, statusCode: number, message: string }> => {
	if (document.uid == res.locals.uid) {
		return { access: true, statusCode: 200, message: "" }
	}
	else if (document.private && document.preventTrusted) {
		return { access: false, statusCode: 401, message: "Access to document has been rejected." }
	}
	else {
		if (friendReadCollections.indexOf(collection) < 0) {
			return { access: false, statusCode: 401, message: "Access to document has been rejected." }
		}

		const friendLevel: FriendLevel = await getFriendLevel(res.locals.uid, req.params.id);
		const isaFriend = await isFriend(friendLevel);
		if (!isaFriend) {
			return { access: false, statusCode: 401, message: "Access to document has been rejected." }
		}
		else {
			if (document.private) {
				const trustedFriend: boolean = await isTrustedFriend(friendLevel);
				if (trustedFriend) {
					return { access: true, statusCode: 200, message: "" }
				}
				else {
					return { access: false, statusCode: 401, message: "Access to document has been rejected." }
				}
			}
			else {
				return { access: true, statusCode: 200, message: "" }
			}
		}
	}
}

export const sendDocuments = async (req: Request, res: Response, collection: string, documents: documentObject[]) => {

	const returnDocuments: any[] = [];

	for (let i = 0; i < documents.length; ++i) {
		const access = await getDocumentAccess(req, res, documents[i], collection);
		if (access.access === true) {
			returnDocuments.push(transformResultForClientRead(documents[i], res.locals.uid));
			return;
		}
	}

	res.status(200).send(returnDocuments);
}


export const sendDocument = async (req: Request, res: Response, collection: string, document: documentObject) => {
	const access = await getDocumentAccess(req, res, document, collection);
	if (access.access === true) {
		res.status(200).send(transformResultForClientRead(document, res.locals.uid));
		return;
	}
	return res.status(access.statusCode).send(access.message);
}

export const fetchSimpleDocument = async (req: Request, res: Response, collection: string) => {
	const document = await db.getDocument(req.params.id, req.params.system, collection);
	sendDocument(req, res, collection, document);
}

export const deleteSimpleDocument = async (req: Request, res: Response, collection: string) => {
	const result = await db.delete(req.params.id, res.locals.uid, collection);
	if (result.deletedCount && result.deletedCount > 0) {
		publishDbEvent({ uid: res.locals.uid, documentId: req.params.id, collection: collection, operationType: OperationType.Delete });
	}
	res.status(200).send();
}

export const fetchCollection = async (req: Request, res: Response, collection: string) => {
	const documents = await db.getMultiple({ uid: req.params.system }, req.params.system, collection).toArray();
	sendDocuments(req, res, collection, documents);
}

export const addSimpleDocument = async (req: Request, res: Response, collection: string) => {
	const dataObj: documentObject = req.body;
	dataObj._id = new ObjectID();
	dataObj.uid = res.locals.uid;
	const result = await db.add(collection, dataObj);
	result.connection
	if (result.result.n === 0) {
		res.status(500).send("Server processed your request, however was unable to enter a document into the database");
		return;
	}
	else {
		publishDbEvent({ uid: res.locals.uid, documentId: dataObj._id.toHexString(), collection: collection, operationType: OperationType.Add });
	}

	res.status(200).send();
}

export const updateSimpleDocument = async (req: Request, res: Response, collection: string) => {
	const dataObj: documentObject = req.body;
	dataObj._id = parseId(req.params.id);
	dataObj.uid = res.locals.uid;
	const result = await db.update(req.params.id, res.locals.uid, collection, dataObj);
	if (result.result.n === 0) {
		res.status(404).send();
		return;
	}
	else {
		publishDbEvent({ uid: res.locals.uid, documentId: req.params.id, collection: collection, operationType: OperationType.Update });
	}

	res.status(200).send();
}