
import { Request, Response } from "express";
import { syncAllPkMembersToSp, syncAllSpMembersToPk, syncMemberToPk } from "../../modules/integrations/pk/sync"
import { validateSchema } from "../../util/validation";

export const performSyncMemberToPk = async (req: Request, res: Response) => {
	const result = await syncMemberToPk(req.body.options, req.body.member, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send();
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const performSyncMemberFromPk = async (req: Request, res: Response) => {
	const result = await syncMemberToPk(req.body.options, req.body.member, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send();
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const performSyncAllMemberToPk = async (req: Request, res: Response) => {
	const result = await syncAllSpMembersToPk(req.body.options, req.body.syncOptions, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send();
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const performSyncAllMemberFromPk = async (req: Request, res: Response) => {
	const result = await syncAllPkMembersToSp(req.body.options, req.body.syncOptions, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send();
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const validateSyncMemberSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		member: { type: "string" },
		token: { type: "string" },
		options: {
			type: "object",
			properties: {
				name: { type: "boolean", },
				avatar: { type: "boolean" },
				pronouns: { type: "boolean" },
				description: { type: "boolean" },
				useDisplayName: { type: "boolean" },
				color: { type: "boolean" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["name", "avatar", "pronouns", "description", "useDisplayName", "color",]
		},
		nullable: false,
		additionalProperties: false,
		required: ["member", "token", "options"]
	};

	return validateSchema(schema, body);
}


export const validateSyncMembersSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		token: { type: "string" },
		options: {
			type: "object",
			properties: {
				name: { type: "boolean", },
				avatar: { type: "boolean" },
				pronouns: { type: "boolean" },
				description: { type: "boolean" },
				useDisplayName: { type: "boolean" },
				color: { type: "boolean" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["name", "avatar", "pronouns", "description", "useDisplayName", "color",]
		},
		syncOptions: {
			type: "object",
			properties: {
				add: { type: "boolean", },
				overwrite: { type: "boolean" },
			},
			nullable: false,
			additionalProperties: false,
			required: ["add", "overwrite"]
		},
		nullable: false,
		additionalProperties: false,
		required: ["member", "token", "options", "syncOptions"]
	};

	return validateSchema(schema, body);
}