import { Request, Response } from "express";
import { parseId } from "../../modules/mongo";
import { fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getAuditHistory = async (req: Request, res: Response) => {
	const query: any = { };

    if (req.query.target)
    {
        query.id = parseId(req.query.target.toString()) 
    }

	fetchCollection(req, res, "audit", query);
};

export const validateGetAuditHistorySchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			target: { type: "string", pattern: "^[A-Za-z0-9]{5,50}$" },
            sortBy: { type: "string" },
            sortOrder: { type: "string", pattern: "^-1$|^1$" },
            limit: { type: "string", pattern: "^[0-9]" },
            start: { type: "string", pattern: "^[0-9]" },
            sortUp: { type: "string", pattern: "^(true|false)$" },
		},
		required: [],
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};
