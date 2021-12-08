import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getCustomFronts = async (req: Request, res: Response) => {
	fetchCollection(req, res, "frontStatuses");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "frontStatuses");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "frontStatuses");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "frontStatuses")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "frontStatuses");
}

export const validateCustomFrontSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			avatarUrl: { type: "string" },
			avatarUuid: { type: "string" },
			color: { type: "string" },
			preventTrusted: { type: "boolean" },
			private: { type: "boolean" },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}