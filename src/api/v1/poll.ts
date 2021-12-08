import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getPolls = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "polls");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "polls");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "polls");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "notes")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "polls");
}

export const validatePollSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			custom: { type: "boolean" },
		},
		nullable: false,
		additionalProperties: false,
	};

	const result = validateSchema(schema, body);
	if (!result.success) {
		return result;
	}



	return result;
}