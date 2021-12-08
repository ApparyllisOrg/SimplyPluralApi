import { Request, Response } from "express";
import { addSimpleDocument, deleteSimpleDocument, fetchCollection, fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const getMembers = async (req: Request, res: Response) => {
	fetchCollection(req, res, "members");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "members");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "members");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "members")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "members");
}

export const validateMemberSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			pronouns: { type: "string" },
			pkId: { type: "string" },
			color: { type: "string" },
			avatarUuid: { type: "string" },
			avatarUrl: { type: "string" },
			private: { type: "boolean" },
			preventTrusted: { type: "boolean" },
			preventsFrontNotifs: { type: "boolean" },
			info: {
				type: "object",
				properties: {
					"*": { type: "string" }
				}
			}
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}