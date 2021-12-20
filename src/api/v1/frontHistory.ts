import { ObjectId } from "bson";
import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getFrontHistoryInRange = async (req: Request, res: Response) => {
	const documents : documentObject[] = await getCollection("frontHistory").find({
		$or: [
			{ startTime: { $gte: req.query.start }, endTime: { $lte: req.query.end } },
			{ startTime: { $lte: req.query.start }, endTime: { $gte: req.query.end } },
			{ startTime: { $lte: req.query.end }, endTime: { $gte: req.query.start } },
			{ startTime: { $gte: req.query.start }, endTime: { $lte: req.query.end } }
		]
	}).toArray()

	const documentIds : (string | ObjectId)[] = documents.map((doc) => doc._id);
	const documentComments = await getCollection("frontHistory").find({
		documnetId: { $in: documentIds }, collection: "frontHistory"
	}).toArray()

	// Fill every document with its comments. 
	// TODO: check if there's a better way/faster way to do this
	documentComments.forEach((doc : documentObject) => 
	{
		for (let i = 0; i < documents.length; ++i)
		{
			// todo: Check if this works with both object ids and random ids
			if (documents[i]._id === doc._id)
			{
				if (documents[i].comments)
				{
					const comments: any[] = doc.comments;
					comments.push(doc)
				}
				else
				{
					documents[i].comments = [doc];
				}

				break;
			}
		}
	})

	sendDocuments(req, res, "frontHistory", documents);
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "frontHistory");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "frontHistory");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "frontHistory")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "frontHistory");
}

export const validatefrontHistorySchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
			startTime: { type: "number" },
			endTime: { type: "number" },
			member: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}