import { validationResult } from "express-validator";
import { NextFunction } from "express";
import { Request, Response } from "express";
import addFormats from "ajv-formats"

import Ajv from "ajv";
import { ObjectId } from "mongodb";
import moment from "moment";
import { parseId } from "../modules/mongo";
const ajv = new Ajv({ allErrors: true, $data: true, verbose: true })
addFormats(ajv)

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
			if (process.env.UNITTEST === "true")
			{
				console.error(result.msg)
			}

			res.status(400).send(result.msg);
		}
		else {
			next();
		}
	};
}

export const validateSchema = (schema: any, body: any): { success: boolean, msg: string } => {
	const validate = ajv.compile(schema)

	const valid = validate(body);
	if (valid) {
		return { success: true, msg: "" }
	}
	else {
		let fullError = "";
		validate.errors?.forEach((err) => {
			if (err.keyword == "additionalProperties")
			{
				fullError += `Error at ${err.params.additionalProperty}, this is not a valid property name.`
			} 
			else if (err.keyword == "type")
			{
				fullError += `Error at ${err.instancePath}, the property must be of type ${err.schema}.`
			}
			else {
				fullError += `Error at ${JSON.stringify(err.params)} with error ${err.message}`;
			}
			fullError += "\n"
		});

		return { success: false, msg: fullError }
	}
}

export const validateParams = (req: Request, res: Response) => {
	const schema = {
		type: "object",
		properties: {
			id: { type: "string", pattern: "^[A-Za-z0-9]{0,100}$" },
			dashedid: { type: "string", pattern: "^[A-Za-z0-9\-]{0,100}$" },
			reportid: { type: "string", pattern: "^[A-Za-z0-9\-]{0,100}$" },
			system: { type: "string", pattern: "^[A-Za-z0-9]{1,50}$" },
			member: { type: "string", pattern: "^[A-Za-z0-9]{1,50}$" },
			type: { type: "string", pattern: "^[A-Za-z0-9]{1,50}$" },
			usernameOrId: { type: "string", pattern: "^[A-Za-z0-9-_]{1,50}$" },
		},
		nullable: false,
		additionalProperties: false,
	};

	const validate = ajv.compile(schema)
	const valid = validate(req.params);

	if (valid) {
		return true;
	}
	else {
		res.status(400).send("URL Params contain illegal characters");
	}

	return false;
}

export const validateGetQuery = (req: Request, res: Response, next: NextFunction) => {
	if (req.method === "GET") {
		const schema = {
			type: "object",
			properties: {
				sortBy: { type: "string" },
				sortUp: { type: "boolean" },
				limit: { type: "string", pattern: "^[0-9]" },
				start: { type: "string", pattern: "^[0-9]" },
			},
			nullable: false,
			dependencies: {
				sortBy: { required: ["sortUp"] },
				sortUp: { required: ["sortBy"] },
			}
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

export const validatePostId = (req: Request, res: Response) : boolean => {
	if (req.method === "POST") {
		if (req.params.id && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
			if (ObjectId.isValid(req.params.id)) {
				res.locals.useId = new ObjectId(req.params.id);
				return true;
			}
		}
		else if (!req.params.id) {
			return true;
		}

		res.status(400).send("Id does not resolve to a mongo id");
		return false
	}

	return true;
}

export const validateId = async (req: Request, res: Response, next: any) => {
	if (req.params.id && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
		if (ObjectId.isValid(req.params.id)) {
			res.locals.useId = new ObjectId(req.params.id);
			next();
			return;
		}
	}
	else if (!req.params.id) {
		next();
		return;
	}

	res.status(400).send("Id does not resolve to a mongo id");
}

export const validateOperationTime = async (req: Request, res: Response, next: any) => {
	// Expects milliseconds since epoch
	const operationTime = req.header("Operation-Time");
	if (operationTime) {
		const parsedInt = parseInt(operationTime);
		if (!isNaN(parsedInt)) {
			res.locals.operationTime = Math.min(parsedInt, moment.now());
			next();
			return;
		}
	}
	else {
		res.locals.operationTime = moment.now();
		next();
		return;
	}

	res.status(400).send("Operation-Time header is not a valid number");
}

export const getPrivacyDependency = () => ({
			private: { required: ["preventTrusted"] },
			preventTrusted: { required: ["private"] }
		})