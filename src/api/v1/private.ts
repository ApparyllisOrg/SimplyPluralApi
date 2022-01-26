import { Request, Response } from "express";
import moment from "moment";
import { getCollection, parseId } from "../../modules/mongo";
import { addSimpleDocument, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";
import { setupNewUser } from "./user";
import { updateUser } from "./user/updates/updateUser";

export const get = async (req: Request, res: Response) => {
	const privateDocument = await getCollection("private").findOne({ uid: res.locals.uid, _id: parseId(req.params.id) })
	if (!privateDocument && req.params.id === res.locals.uid) {
		await getCollection("private").insertOne({ uid: res.locals.uid, _id: res.locals.uid, termsOfServicesAccepted: false });
	}
	await updateGenerationLimit(res.locals.uid, privateDocument);
	fetchSimpleDocument(req, res, "private");
}

export const update = async (req: Request, res: Response) => {
	const previousDocument = await getCollection("private").findOne({ uid: res.locals.uid, _id: parseId(req.params.id) })
	if (previousDocument) {
		if (previousDocument.latestVersion && previousDocument.latestVersion < req.body.latestVersion) {
			await updateUser(previousDocument.latestVersion, req.body.latestVersion, res.locals.uid)
		}
		updateSimpleDocument(req, res, "private")
	}
	else {
		await setupNewUser(res.locals.uid)
		addSimpleDocument(req, res, "private")
	}
}

export const validatePrivateSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			notificationToken: { type: "array", items: { type: "string" } },
			lastUpdate: { type: "number" },
			latestVersion: { type: "number" },
			location: { type: "string" },
			termsOfServiceAccepted: { type: "boolean", enum: [true] },
			whatsNew: { type: "number" },
		},
		nullable: false,
		additionalProperties: false,

	};

	return validateSchema(schema, body);
}

const resetGenerationLimit = async (uid: string) => {
	const user = await getCollection("users").findOne({ uid, _id: uid })
	await getCollection("private").updateOne({ uid, _id: uid }, { $set: { generationsLeft: user.patron === true ? 10 : 3 }, lastGenerationReset: moment.now() });
}

const updateGenerationLimit = async (uid: string, doc: any) => {
	if (doc.lastGenerationReset) {
		const last = moment(doc.lastGenerationReset)
		last.add("7 days")

		if (moment.now() >= last.valueOf()) {
			await resetGenerationLimit(uid);
		}
	}
	else {
		await resetGenerationLimit(uid);
	}
}