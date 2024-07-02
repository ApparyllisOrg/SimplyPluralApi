import { Request, Response } from "express";
import moment from "moment";
import { userLog } from "../../modules/logger";
import { getCollection, parseId } from "../../modules/mongo";
import { addSimpleDocument, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";
import { setupNewUser } from "./user";
import { updateUser } from "./user/updates/updateUser";

export const get = async (req: Request, res: Response) => {
	const privateDocument = await getCollection("private").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	if (!privateDocument && req.params.id === res.locals.uid) {
		await getCollection("private")
			.insertOne({ uid: res.locals.uid, _id: res.locals.uid, termsOfServicesAccepted: false })
			.catch(() => {
				null;
			});
	}
	await updateGenerationLimit(res.locals.uid, privateDocument);
	fetchSimpleDocument(req, res, "private");
};

export const update = async (req: Request, res: Response) => {
	const previousDocument = await getCollection("private").findOne({ uid: res.locals.uid, _id: res.locals.uid });
	if (previousDocument) {
		if (previousDocument.latestVersion && previousDocument.latestVersion < req.body.latestVersion) {
			await updateUser(previousDocument.latestVersion, req.body.latestVersion, res.locals.uid);
			userLog(res.locals.uid, `Updated user account to version ${req.body.latestVersion}`);
		}

		if (req.body.categories) {
			const expectedCategories = await getCollection("channelCategories").find({ uid: res.locals.uid }).toArray();

			const categories: string[] = req.body.categories;
			for (let i = categories.length - 1; i >= 0; --i) {
				const category = categories[i];
				const categoryDoc = expectedCategories.findIndex((value: any) => value._id == parseId(category));
				if (!categoryDoc) {
					categories.splice(i, 1);
				}
			}

			expectedCategories.forEach((category: any) => {
				if (categories.findIndex((value) => value == category._id.toString()) == -1) {
					categories.push(category._id.toString());
				}
			});

			req.body.categories = categories;
		}

		updateSimpleDocument(req, res, "private");
	} else {
		await setupNewUser(res.locals.uid);
		addSimpleDocument(req, res, "private");
	}
};

const s_validatePrivateSchema = {
	type: "object",
	properties: {
		notificationToken: { type: "array", items: { type: "string" } },
		lastUpdate: { type: "number" },
		latestVersion: { type: "number" },
		location: { type: "string" },
		termsOfServiceAccepted: { type: "boolean", enum: [true] },
		whatsNew: { type: "number" },
		categories: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
	},
	nullable: false,
	additionalProperties: false,
};
const v_validatePrivateSchema = ajv.compile(s_validatePrivateSchema)

export const validatePrivateSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validatePrivateSchema, body);
};

const resetGenerationLimit = async (uid: string) => {
	const user = await getCollection("users").findOne({ uid, _id: uid });
	await getCollection("private").updateOne({ uid, _id: uid }, { $set: { generationsLeft: user?.patron === true ? 10 : 3, lastGenerationReset: moment.now() } });
};

const updateGenerationLimit = async (uid: string, doc: any) => {
	if (doc?.lastGenerationReset) {
		let last = moment(doc.lastGenerationReset);
		last = last.add(7, "days");

		if (moment.now() >= last.valueOf()) {
			await resetGenerationLimit(uid);
		}
	} else {
		await resetGenerationLimit(uid);
	}
};
