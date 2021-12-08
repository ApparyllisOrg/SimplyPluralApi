import { Request, Response } from "express";
import { fetchSimpleDocument, updateSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "private");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "private")
}

export const validatePrivateSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			notificationToken: { type: "array", items: { type: "string" } },
			lastUpdate: { type: "number" },
			latestVersion: { type: "number" },
			location: { type: "string" },
			termsOfServiceAccepted: { type: "boolean" },
			whatsNew: { type: "number" },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}