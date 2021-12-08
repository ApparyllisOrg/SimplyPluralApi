import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, fetchCollection, deleteSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getGroups = async (req: Request, res: Response) => {
	fetchCollection(req, res, "groups");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "groups");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "groups");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "groups")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "groups");
}

export const validateGroupSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			parent: { type: "string" },
			color: { type: "string" },
			private: { type: "boolean" },
			preventTrusted: { type: "boolean" },
			name: { type: "string" },
			desc: { type: "string" },
			emoji: { type: "string" },
			members: { type: "array", items: { type: "string" } },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}