import { Request, Response } from "express";
import { ApiKeyAccessType, assignApiKey, generateNewApiKey } from "../../modules/api/keys";
import { getCollection, parseId } from "../../modules/mongo";
import { logSecurityUserEvent } from "../../security";
import { deleteSimpleDocument, fetchCollection, fetchSimpleDocument } from "../../util";
import { ajv, validateSchema } from "../../util/validation";

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "tokens");
};

export const getPermission = async (req: Request, res: Response) => {
	const token = await getCollection("tokens").findOne({ token: req.headers.authorization });
	res.status(200).send(token.permission.toString());
};

export const getAll = async (req: Request, res: Response) => {
	fetchCollection(req, res, "tokens", {});
};

export const add = async (req: Request, res: Response) => {
	const token = await generateNewApiKey();

	let read = false;
	let write = false;
	let del = false;

	if (req.body.permission & ApiKeyAccessType.Read) read = true;
	if (req.body.permission & ApiKeyAccessType.Write) write = true;
	if (req.body.permission & ApiKeyAccessType.Delete) del = true;

	const success = await assignApiKey(read, write, del, token, res.locals.uid);
	if (!success) {
		res.status(400).send("You need to specify at least one permission");
	} else {
		let permissions = ""

		if (read) {
			permissions += "\nRead"
		}

		if (write) {
			permissions += "\nWrite"
		}

		if (del) {
			permissions += "\nDelete"
		}

		logSecurityUserEvent(res.locals.uid, "Added token with following permissions: " + permissions, req);
		res.status(200).send(token);
	}
};

export const del = async (req: Request, res: Response) => {
	const toDeleteToken = await getCollection("tokens").findOne({ uid: res.locals.uid, _id: parseId(req.params.id) });
	if (toDeleteToken) {
		const obfuscatedToken = toDeleteToken.token.slice(0, 15) + "...";
		logSecurityUserEvent(res.locals.uid, "Deleted token: " + obfuscatedToken, req);
	}
	deleteSimpleDocument(req, res, "tokens");
};

const s_validateApiKeySchema = {
	type: "object",
	properties: {
		permission: { type: "number" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["permission"],
};
const v_validateApiKeySchema = ajv.compile(s_validateApiKeySchema)

export const validateApiKeySchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateApiKeySchema, body);
};
