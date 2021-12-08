import { validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";

import Ajv from "ajv";
const ajv = new Ajv({ allErrors: true, $data: true })

export async function validateData(req: Request, res: Response, next: any) {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	next();
}

export function validateObj(obj: any) {
	if (obj.prototype.hasOwnProperty.call("uid")) return "Object contains illegal field uid";
	if (obj.prototype.hasOwnProperty.call("ttl")) return "Object contains illegal field ttl";
}

type schemavalidation = (body: any) => { success: boolean, msg: string }

export const validateQuery = (func: schemavalidation) => {
	return async (req: Request, res: Response, next: any) => {
		const result = func(req.query);
		if (!result.success) {
			res.status(400).send(result.msg);
		}
		else {
			next();
		}
	};
}

export const validateBody = (func: schemavalidation) => {
	return async (req: Request, res: Response, next: any) => {
		const result = func(req.body);
		if (!result.success) {
			res.status(400).send(result.msg);
		}
		else {
			next();
		}
	};
}

export const validateSchema = (schema: any, body: any): { success: boolean, msg: string } => {
	// todo: check if compiling here is expensive, and if so only do it once on bootup for all
	// available schemas..
	const validate = ajv.compile(schema)

	const valid = validate(body);
	if (valid) {
		return { success: true, msg: "" }
	}
	else {
		return { success: false, msg: ajv.errorsText(validate.errors) }
	}
}

export const validateGetQuery = (req: Request, res: Response, next: NextFunction) => {
	if (req.method === "GET") {
		const schema = {
			type: "object",
			properties: {
				id: { type: "string", pattern: "^[A-z0-9]{0,50}$" },
				system: { type: "string", pattern: "^[A-z0-9]{0,50}$" },
				member: { type: "string", pattern: "^[A-z0-9]{0,50}$" },
			},
			nullable: false,
			additionalProperties: false,
		};

		const validate = ajv.compile(schema)

		const valid = validate(req.query);
		if (valid) {
			next();
		}
		else {
			res.status(400).send(ajv.errorsText(validate.errors));
		}

		return;
	}
	next();
}