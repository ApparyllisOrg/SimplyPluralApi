import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { addSimpleDocument, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";
import { setupNewUser } from "./user";
import { updateUser } from "./user/updates/updateUser";

export const get = async (req: Request, res: Response) => {
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