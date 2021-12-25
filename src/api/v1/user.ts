import { Request, Response } from "express";
import { auth } from "firebase-admin";
import shortUUID from "short-uuid";
import { userLog } from "../../modules/logger";
import { db, getCollection } from "../../modules/mongo";
import { sendDocument } from "../../util";
import { validateSchema } from "../../util/validation";
import { generateUserReport } from "./user/generateReport";
import { createUser } from "./user/migrate";
import { update122 } from "./user/updates/update112";

export const generateReport = async (req: Request, res: Response) => {
	const htmlFile = await generateUserReport(req.query, res.locals.uid);
	res.status(200).send(htmlFile);
}

export const get = async (req: Request, res: Response) => {
	// todo: remove private fields for friends
	let document = await getCollection("users").findOne({ uid: req.params.id })

	const ownDocument = req.params.id === res.locals.uid;

	// create the user
	if (!document && ownDocument) {
		await createUser(res.locals.uid);
		document = await getCollection("users").findOne({ uid: res.locals.uid })
	}

	// initialize custom fields for the user
	if (!document.fields && ownDocument) {
		await initializeCustomFields(res.locals.uid);
		document = await getCollection("users").findOne({ uid: res.locals.uid })
	}

	sendDocument(req, res, "users", document);
}

export const update = async (req: Request, res: Response) => {
	const setBody = req.body;
	setBody.lastOperationTime = res.locals.operationTime
	const result = await getCollection("users").updateOne({
		uid: res.locals.uid, $or: [
			{ lastOperationTime: null },
			{ lastOperationTime: { $lte: res.locals.operationTime } }
		]
	}, { $set: setBody });
	if (result.result.n === 0) {
		res.status(404).send();
		return;
	}
	res.status(200).send();
}

export const SetUsername = async (req: Request, res: Response) => {
	const newUsername: string = req.body["username"].trim();

	console.log("Attempt to set username to: " + newUsername);

	if (newUsername.length < 3) {
		res.status(200).send({ success: false, msg: "Username must be at least 3 characters" });
		return;
	}

	const potentiallyAlreadyTakenUserDoc = await getCollection("users").findOne({ username: { $regex: "^" + newUsername + "$", $options: "i" }, uid: { $ne: res.locals.uid } });

	if (potentiallyAlreadyTakenUserDoc === null) {
		getCollection("users").updateOne({
			uid: res.locals.uid, $or: [
				{ lastOperationTime: null },
				{ lastOperationTime: { $lte: res.locals.operationTime } }
			]
		}, { $set: { username: newUsername, lastOperationTime: res.locals.operationTime } });
		res.status(200).send({ success: true });
		userLog(res.locals.uid, "Updated username to: " + newUsername);
		return;
	} else {
		res.status(200).send({ success: false, msg: "This username is already taken" });
		return;
	}
};

export const deleteAccount = async (req: Request, res: Response) => {
	const perform: boolean = req.body["performDelete"];

	if (!perform) {
		res.status(202).send();
		return;
	}

	const collections = await db()!.listCollections().toArray();

	collections.forEach(async (collection) => {
		const name: string = collection.name;
		const split = name.split(".");
		const actualName = split[split.length - 1];

		await getCollection(actualName).deleteMany({ uid: res.locals.uid });
	});

	await getCollection("friends").deleteMany({ frienduid: res.locals.uid });
	await getCollection("pendingFriendRequests")
		.deleteMany({ receiver: { $eq: res.locals.uid } });
	await getCollection("pendingFriendRequests")
		.deleteMany({ sender: { $eq: res.locals.uid } });

	auth().deleteUser(res.locals.uid);

	userLog(res.locals.uid, "Deleted user");

	res.status(200).send();
};

export const exportUserData = async (_req: Request, res: Response) => {
	const collections = await db()!.listCollections().toArray();

	const allData: Array<any> = [];

	collections.forEach(async (collection) => {
		const name: string = collection.name;
		const split = name.split(".");
		const actualName = split[split.length - 1];

		const collectionData = await getCollection(actualName).find({ uid: res.locals.uid }).toArray();
		allData.concat(collectionData);
	});

	// TODO: Send email to user at registered user address with a plain json file of all data
	res.status(200).send({});
	userLog(res.locals.uid, "Exported user data.");
};

export const setupNewUser = async (uid: string) => {

	const fields: any = {};
	fields[shortUUID.generate().toString() + "0"] = { name: "Birthday", order: 0, private: false, preventTrusted: false, type: 5 };
	fields[shortUUID.generate().toString() + "1"] = { name: "Favorite Color", order: 1, private: false, preventTrusted: false, type: 1 };
	fields[shortUUID.generate().toString() + "2"] = { name: "Favorite Food", order: 2, private: false, preventTrusted: false, type: 0 };
	fields[shortUUID.generate().toString() + "3"] = { name: "System Role", order: 3, private: false, preventTrusted: false, type: 0 };
	fields[shortUUID.generate().toString() + "4"] = { name: "Likes", order: 4, private: false, preventTrusted: false, type: 0 };
	fields[shortUUID.generate().toString() + "5"] = { name: "Dislikes", order: 5, private: false, preventTrusted: false, type: 0 };
	fields[shortUUID.generate().toString() + "6"] = { name: "Age", order: 6, private: false, preventTrusted: false, type: 0 };

	await getCollection("users").updateOne({
		_id: uid,
		uid: uid,
		fields: { $exists: false }
	}, { $set: { "fields": fields } }, { upsert: true });

	userLog(uid, "Setup new user account");
};

export const initializeCustomFields = async (uid: string) => {
	const userDoc = await getCollection("users").findOne({ uid: uid });
	if (userDoc["fields"]) {
		// Already have fields, don't setup!
		return;
	}

	const memberWithFields = await getCollection("members").findOne({ uid: uid, info: { $exists: true } });
	if (memberWithFields) {
		update122(uid);
	}
	else {
		setupNewUser(uid);
	}
};

export const validateUserSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			shownMigration: { type: "boolean" },
			desc: { type: "string" },
			fromFirebase: { type: "boolean" },
			isAsystem: { type: "boolean" },
			avatarUuid: { type: "string" },
			color: { type: "string" },
			fields: {
				type: "object",
				patternProperties: {
					"^[0-9A-z]{22}$": {
						type: "object",
						properties: {
							name: { type: "string" },
							order: { type: "number" },
							private: { type: "boolean" },
							preventTrusted: { type: "boolean" },
							type: { type: "number" },
						},
						required: ["name", "order", "private", "preventTrusted", "type"]
					}
				},
				additionalProperties: false
			}
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}


export const validateUsernameSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			username: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["username"]
	};

	return validateSchema(schema, body);
}

export const validateUserReportSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			frontHistory: {
				nullable: true,
				type: "object",
				properties: {
					start: { type: "number" },
					end: { type: "number" },
					includeMembers: { type: "boolean" },
					includeCustomFronts: { type: "boolean" },
					privacyLevel: { type: "number" },
				},
				required: ["privacyLevel", "includeMembers", "includeCustomFronts", "start", "end"]
			},
			members: {
				nullable: true,
				type: "object",
				properties: {
					includeCustomFields: { type: "boolean" },
					privacyLevel: { type: "number" },
				},
				required: ["privacyLevel", "includeCustomFields"]
			},
			customFronts: {
				nullable: true,
				type: "object",
				properties: {
					privacyLevel: { type: "number" },
				},
				required: ["privacyLevel"]
			}
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}