import { Request, Response } from "express";
import { userLog } from "../../../modules/logger";
import { getCollection } from "../../../modules/mongo";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, sendDocuments, deleteSimpleDocument, fetchCollection } from "../../../util";
import { SimplyBeingDb } from "../../../util/types";
import { validateSchema } from "../../../util/validation";
import { performUsernameUpdate } from "../../common/user";

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "users", SimplyBeingDb);
}

export const update = async (req: Request, res: Response) => {
	if (req.body.dashboardItems)
	{
		// TODO Ensure the types and type id's exist
	}

	updateSimpleDocument(req, res, "users", SimplyBeingDb)
}

export const del = async (req: Request, res: Response) => {
	// TODO
}

export const setUsername = async (req: Request, res: Response) =>
{
	performUsernameUpdate(req, res, SimplyBeingDb)
}

export const validateUserSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			dashboardItems: { type: "array", items: {
				type: "object",
				properties: {
					type: { type: "string" },
					id: { type: "string" },
				},
				required: ["name", "desc"],
				nullable: false,
				additionalProperties: false,
				}  
			},
			dashboardTimeRange : {
				type: "number",
				maximum: 14,
				minimum: 2
			}
		},
		required: ["name", "desc"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}