import { ObjectId } from "bson";
import { Request, Response } from "express";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getFrontHistoryInRange = async (req: Request, res: Response) => {
	const documents: documentObject[] = await getCollection("frontHistory").find({
		$or: [
			{ startTime: { $gte: req.query.start }, endTime: { $lte: req.query.end } },
			{ startTime: { $lte: req.query.start }, endTime: { $gte: req.query.end } },
			{ startTime: { $lte: req.query.end }, endTime: { $gte: req.query.start } },
			{ startTime: { $gte: req.query.start }, endTime: { $lte: req.query.end } }
		]
	}).toArray()

	const documentIds: (string | ObjectId)[] = documents.map((doc) => doc._id);
	const documentComments = await getCollection("comments").find({
		documnetId: { $in: documentIds }, collection: "frontHistory"
	}).toArray()

	// Fill every document with its comments.
	// TODO: check if there's a better way/faster way to do this
	documentComments.forEach((doc: documentObject) => {
		for (let i = 0; i < documents.length; ++i) {
			// todo: Check if this works with both object ids and random ids
			if (documents[i]._id === doc._id) {
				if (documents[i].comments) {
					const comments: any[] = doc.comments;
					comments.push(doc)
				}
				else {
					documents[i].comments = [doc];
				}

				break;
			}
		}
	})

	sendDocuments(req, res, "frontHistory", documents);
}

export const getFrontHistory = async (req: Request, res: Response) => {
	fetchCollection(req, res, "frontHistory", {});
}

export const getFrontHistoryForMember = async (req: Request, res: Response) => {
	fetchCollection(req, res, "frontHistory", { member: req.params.id });
}

export const getFronters = async (req: Request, res: Response) => {
	const documents: documentObject[] = await getCollection("frontHistory").find({ uid: res.locals.uid, live: true }).toArray()
	sendDocuments(req, res, "frontHistory", documents);
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "frontHistory");
}

export const add = async (req: Request, res: Response) => {
	const potentiallyFrontingDoc = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.body.member, live: true })
	if (potentiallyFrontingDoc) {
		res.status(409).send("This member is already set to be fronting. Remove them from front prior to adding them to front")
	}
	else {
		frontChange(res.locals.uid, false, req.body.MemberFront)
		addSimpleDocument(req, res, "frontHistory");
	}
}

export const update = async (req: Request, res: Response) => {
	const frontingDoc = await getCollection("frontHistory").findOne({ _id: parseId(req.params.id) })
	if (frontingDoc) {
		if (frontingDoc.live === false && req.body.live === true) {
			res.status(400).send("You cannot update a front history entry to live, if you wish to add someone to front, use POST instead.")
			return
		}

		if (frontingDoc.live === true && req.body.live === false) {
			frontChange(res.locals.uid, true, frontingDoc.member)
		}
		updateSimpleDocument(req, res, "frontHistory")
	}
	else {
		res.status(404).send("Unable to find front document to remove")
	}
}

export const del = async (req: Request, res: Response) => {
	const frontingDoc = await getCollection("frontHistory").findOne({ _id: parseId(req.params.id) })

	// If a fronting document is deleted, and it's a live one, notify front change
	if (frontingDoc) {
		if (frontingDoc.live === true) {
			frontChange(res.locals.uid, true, frontingDoc.member)
		}
	}

	// Delete all attached comments
	getCollection("comments").deleteMany({ documentId: req.params.id, uid: res.locals.uid, collection: "frontHistory" });

	deleteSimpleDocument(req, res, "frontHistory");
}

export const validatefrontHistorySchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
			live: { type: "boolean" },
			startTime: { type: "number" },
			endTime: { type: "number" },
			member: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
		required: ["custom", "live", "startTime", "member"]
	};

	return validateSchema(schema, body);
}