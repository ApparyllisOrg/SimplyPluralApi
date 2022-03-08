import { Request, Response } from "express";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getFrontHistoryInRange = async (req: Request, res: Response) => {
	const query = {
		$or: [
			{ startTime: { $gte: Number(req.query.startTime) }, endTime: { $gte: Number(req.query.endTime) } }, // starts after start, ends after end
			{ startTime: { $lte: Number(req.query.startTime) }, endTime: { $gte: Number(req.query.startTime) } }, //start before start, ends after start
			{ startTime: { $gte: Number(req.query.startTime) }, endTime: { $lte: Number(req.query.endTime) } }, // start after start, ends before end
			{ startTime: { $lte: Number(req.query.endTime) }, endTime: { $gte: Number(req.query.endTime) } } //Starts before end, ends after end
		]
	}

	const documents: documentObject[] = await getCollection("frontHistory").find(query).toArray()

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
		frontChange(res.locals.uid, false, req.body.member)
		addSimpleDocument(req, res, "frontHistory");
	}
}

export const update = async (req: Request, res: Response) => {
	const frontingDoc = await getCollection("frontHistory").findOne({ _id: parseId(req.params.id) })
	if (frontingDoc) {
		if (frontingDoc.live === false && req.body.live === true) {
			res.status(409).send("You cannot update a front history entry to live, if you wish to add someone to front, use POST instead.")
			return
		}

		if (req.body.member != null && req.body.member != undefined && frontingDoc.live === true) {
			const alreadyFrontingDoc = await getCollection("frontHistory").findOne({ member: req.body.member, live: true })
			if (alreadyFrontingDoc && alreadyFrontingDoc._id != req.params.id) {
				res.status(409).send("You cannot change an active front entry to this member, they are already fronting")
				return
			}
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

export const validatefrontHistoryPostSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
			live: { type: "boolean" },
			startTime: { type: "number" },
			endTime: { type: "number" },
			member: { type: "string" },
			customStatus: { type: "string", maxLength: 50 }
		},
		nullable: false,
		additionalProperties: false,
		required: ["custom", "live", "startTime", "member"]
	};

	return validateSchema(schema, body);
}

export const validatefrontHistoryPatchSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
			live: { type: "boolean" },
			startTime: { type: "number" },
			endTime: { type: "number" },
			member: { type: "string" },
			customStatus: { type: "string", maxLength: 50 }
		},
		nullable: false,
		additionalProperties: false
	};

	return validateSchema(schema, body);
}

// Query params so we have to use string pattern comparison
// Query proeprties are always strings
export const validateGetfrontHistorychema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			startTime: { type: "string", pattern: "^[0-9]" },
			endTime: { type: "string", pattern: "^[0-9]" },
		},
		nullable: false,
		required: ["startTime", "endTime"]
	};

	return validateSchema(schema, body);
}