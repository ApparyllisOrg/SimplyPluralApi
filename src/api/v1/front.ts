import { Request, Response } from "express";
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