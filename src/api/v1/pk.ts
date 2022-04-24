
import { Request, Response } from "express";
import { syncAllPkMembersToSp, syncAllSpMembersToPk, syncMemberFromPk, syncMemberToPk } from "../../modules/integrations/pk/sync"
import { validateSchema } from "../../util/validation";

export const performSyncMember = async (req: Request, res: Response) => {
	if (req.query.direction === "push") {
		performSyncMemberToPk(req, res);
	} else {
		performSyncMemberFromPk(req, res);
	}
}

export const performSyncMemberToPk = async (req: Request, res: Response) => {
	const result = await syncMemberToPk(req.body.options, req.body.member, req.body.token, res.locals.uid, undefined)
	if (result.success) {
		res.status(200).send({ success: true, msg: result.msg });
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const performSyncMemberFromPk = async (req: Request, res: Response) => {
	const result = await syncMemberFromPk(req.body.options, req.body.member, req.body.token, res.locals.uid, undefined, undefined, false)
	if (result.success) {
		res.status(200).send({ success: true, msg: result.msg });
	}
	else {
		res.status(400).send(result.msg);
	}
}

export const performSyncAllMembers = async (req: Request, res: Response) => {
	if (req.query.direction === "push") {
		performSyncAllMemberToPk(req, res);
	}
	else {
		performSyncAllMemberFromPk(req, res);
	}
}

const performSyncAllMemberToPk = async (req: Request, res: Response) => {
	const result = await syncAllSpMembersToPk(req.body.options, req.body.syncOptions, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send({ success: true, msg: `Syncing all members to PluralKit` });
	}
	else {
		res.status(400).send({ success: false, msg: result.msg });
	}
}

const performSyncAllMemberFromPk = async (req: Request, res: Response) => {
	const result = await syncAllPkMembersToSp(req.body.options, req.body.syncOptions, req.body.token, res.locals.uid)
	if (result.success) {
		res.status(200).send({ success: true, msg: `Synced all members from PluralKit` });
	}
	else {
		res.status(400).send({ success: false, msg: result.msg });
	}
}


export const validateSyncDirectionSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			direction: { anyOf: [{ type: "string", enum: ["push"] }, { type: "string", enum: ["pull"] }] },
		},
		required: ["direction"],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export const validateSyncMemberSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
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
			}
		},
		nullable: false,
		additionalProperties: false,
		required: ["member", "token", "options"]
	};

	return validateSchema(schema, body);
}

export const validateSyncMembersSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
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
					privateByDefault: { type: "boolean" },
				},
				nullable: false,
				additionalProperties: false,
				required: ["add", "overwrite"]
			}
		},
		nullable: false,
		additionalProperties: false,
		required: ["token", "options", "syncOptions"]
	};

	return validateSchema(schema, body);
}
