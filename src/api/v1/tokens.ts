import { Request, Response } from "express";
import { assignApiKey, generateNewApiKey } from "../../modules/api/keys";
import { deleteSimpleDocument, fetchCollection, fetchSimpleDocument } from "../../util";
import { validateSchema } from "../../util/validation";


export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "tokens");
}

export const getAll = async (req: Request, res: Response) => {
	fetchCollection(req, res, "tokens", {});
}

export const add = async (req: Request, res: Response) => {
	const token = await generateNewApiKey();
	const success = await assignApiKey(req.body.read, req.body.write, req.body.delete, token, res.locals.uid);
	if (!success) {
		res.status(400).send("You need to specify at least one permission");
	}
	else {
		res.status(200).send(token);
	}
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "tokens");
}

export const validateApiKeySchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			permission: { type: "number" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["permission"]
	};

	return validateSchema(schema, body);
}