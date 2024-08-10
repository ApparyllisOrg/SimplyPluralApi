import { Request, Response } from "express";
import { getCollection, parseId } from "../../modules/mongo";
import { deleteSimpleDocument, fetchCollection } from "../../util";
import { ajv, validateSchema } from "../../util/validation";
import { OperationType, dispatchDelete } from "../../modules/socket";

export const getAuditHistory = async (req: Request, res: Response) => {
	const query: any = { };

    if (req.query.target)
    {
        query.id = parseId(req.query.target.toString()) 
    }

	fetchCollection(req, res, "audit", query);
};

export const deleteExpiredAuditEntries = async (req: Request, res: Response) => {
	const query = {
		uid: res.locals.uid,
		exp : { $lte: res.locals.operationTime },
		$or: [{ lastOperationTime: null }, { lastOperationTime: { $lte: res.locals.operationTime } }],
	}

	const result = await getCollection('audit').deleteMany(query);

	if (result.deletedCount && result.deletedCount > 0) {
		res.status(200).send();
	} else {
		res.status(404).send();
	}
};


export const deleteAuditEntry = async (req: Request, res: Response) => {
	const query = {
		_id: parseId(req.params.id),
		uid: res.locals.uid,
		exp : { $lte: res.locals.operationTime },
		$or: [{ lastOperationTime: null }, { lastOperationTime: { $lte: res.locals.operationTime } }],
	}

	const result = await getCollection('audit').deleteOne(query);

	if (result.deletedCount && result.deletedCount > 0) {
		dispatchDelete({
			operationType: OperationType.Delete,
			uid: res.locals.uid,
			documentId: req.params.id,
			collection: 'audit',
		});
		res.status(200).send();
	} else {
		res.status(404).send();
	}
};

const s_validateGetAuditHistorySchema = {
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
const v_validateGetAuditHistorySchema = ajv.compile(s_validateGetAuditHistorySchema)

export const validateGetAuditHistorySchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateGetAuditHistorySchema, body);
};
