import { Request, Response } from "express";
import shortUUID from "short-uuid";
import { userLog } from "../../modules/logger";
import { db, getCollection } from "../../modules/mongo";
import { sendDocument } from "../../util";
import { validateSchema } from "../../util/validation";
import { generateUserReport } from "./user/generateReport";
import { createUser } from "./user/migrate";
import { update122 } from "./user/updates/update112";
import AWS from "aws-sdk";
import { nanoid } from "nanoid";
import { auth } from "firebase-admin";

const spacesEndpoint = new AWS.Endpoint("sfo3.digitaloceanspaces.com");
const s3 = new AWS.S3({
	endpoint: spacesEndpoint,
	accessKeyId: process.env.SPACES_KEY,
	secretAccessKey: process.env.SPACES_SECRET,
});


export const generateReport = async (req: Request, res: Response) => {

	const canGenerate = await canGenerateReport(res);
	if (canGenerate) {
		performReportGeneration(req, res)
		decrementGenerationsLeft(res.locals.uid)
		return;
	}
	else {
		res.status(403).send("You do not have enough generations left in order to generate a new report");
		return;
	}
}

const decrementGenerationsLeft = async (uid: string) => {
	const user: any | null = await getCollection("users").findOne({ uid, _id: uid })
	const patron: boolean = user?.patron ?? false;

	const privateDoc = await getCollection("private").findOne({ uid, _id: uid });
	if (privateDoc.generationsLeft) {
		await getCollection("private").updateOne({ uid, _id: uid }, { $inc: { generationsLeft: -1 } });
	}
	else {
		await getCollection("private").updateOne({ uid, _id: uid }, { $set: { generationsLeft: patron ? 10 : 3 } });
	}
}

const canGenerateReport = async (res: Response): Promise<boolean> => {
	const privateDoc = await getCollection("private").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	if (privateDoc) {
		if (privateDoc.generationsLeft && privateDoc.generationsLeft > 0) {
			return true;
		}
		else if (!privateDoc.generationsLeft) {
			return true;
		}
		return privateDoc.bypassGenerationLimit === true;
	}

	return true;
}

const performReportGeneration = async (req: Request, res: Response) => {
	const htmlFile = await generateUserReport(req.body, res.locals.uid);

	const randomId = (await nanoid(32));
	const randomId2 = (await nanoid(32));
	const randomId3 = (await nanoid(32));

	const path = `reports/${res.locals.uid}/${randomId}/${randomId2}/${randomId3}.html`;

	const params = {
		Bucket: "simply-plural",
		Key: path,
		Body: htmlFile,
		ACL: "public-read",
		ContentType: 'text/html'
	};

	s3.putObject(params, async function (err) {
		if (err) {
			console.log(err)
			res.status(500).send(err);
		} else {
			res.status(200).send({ success: true, msg: "https://simply-plural.sfo3.digitaloceanspaces.com/" + path });
		}
	});
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
	await getCollection("users").updateOne({
		uid: res.locals.uid, $or: [
			{ lastOperationTime: null },
			{ lastOperationTime: { $lte: res.locals.operationTime } }
		]
	}, { $set: setBody });
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
					"^[0-9A-z]{22,23}$": {
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
			/*	TODO: Enable mail delivery of the report
			sendTo: {

				type: "string",
			},
			cc: {

				type: "array", items: { type: "string" },
			},
			*/
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