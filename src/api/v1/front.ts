import { Request, Response } from "express";
import { ObjectID } from "mongodb";
import { db } from "../../modules/mongo";
import { documentObject } from "../../modules/mongo/baseTypes";
import { addSimpleDocument, deleteSimpleDocument, fetchCollection, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getFronters = async (req: Request, res: Response) => {
	// todo: Set historyId of the relevant Front History entry when we get the fronters
	fetchCollection(req, res, "fronters");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "fronters");
}

export const add = async (req: Request, res: Response) => {
	const dataObj: documentObject = req.body;
	dataObj._id = new ObjectID();
	dataObj.uid = res.locals.uid;
	dataObj.startTime = req.body.startTime;
	dataObj.member = req.params.member;

	const result = await db.add("frontHistory", dataObj);

	result.connection
	if (result.result.n === 0) {
		res.status(500).send("Server processed your request, however was unable to enter a document into the database");
		return;
	}
	else {
		publishDbEvent({ uid: res.locals.uid, documentId: dataObj._id.toHexString(), collection: collection, operationType: OperationType.Add });
	}

	addSimpleDocument(req, res, "fronters");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "fronters")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "fronters");
}

export const validatefrontSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			startTime: { type: "number" },
			uuid: { type: "string" }
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}