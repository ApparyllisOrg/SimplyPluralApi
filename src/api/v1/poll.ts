import { Request, Response } from "express";
import { fetchSimpleDocument, addSimpleDocument, updateSimpleDocument, deleteSimpleDocument, fetchCollection } from "../../util";
import { validateSchema } from "../../util/validation";

export const getPolls = async (req: Request, res: Response) => {
	fetchCollection(req, res, "polls");
}

export const get = async (req: Request, res: Response) => {
	fetchSimpleDocument(req, res, "polls");
}

export const add = async (req: Request, res: Response) => {
	addSimpleDocument(req, res, "polls");
}

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "notes")
}

export const del = async (req: Request, res: Response) => {
	deleteSimpleDocument(req, res, "polls");
}

// Todo: write migration code from old poll schema to new poll schema for user data
export const validatePollSchema = (body: any): { success: boolean, msg: string } => {

	const voteType =
	{
		type: "object",
		parameters: {
			id: "string",
			comment: "string"
		},
		nullable: false,
		additionalProperties: false,
	};

	const normalVote = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			allowAbstain: { type: "boolean" },
			allowVeto: { type: "boolean" },
			endTime: { type: "number" },
			custom: {
				type: "boolean",
				"enum": [false]
			},
			votes: {
				type: "array",
				items: voteType
			}
		},
		nullable: false,
		additionalProperties: false,
	}

	const customVote = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			endTime: { type: "number" },
			custom: {
				type: "boolean",
				"enum": [true]
			},
			options: {
				type: "array",
				items: {
					type: "object",
					properties: {
						name: { type: "string" },
						color: { type: "string" },
					},
					nullable: false,
					additionalProperties: false,
				}
			},
			votes: {
				type: "array",
				items: voteType
			},
			nullable: false,
			additionalProperties: false,
		}
	}

	const schema = {
		anyOf: [
			normalVote,
			customVote
		]
	};

	const result = validateSchema(schema, body);
	if (!result.success) {
		return result;
	}

	return result;
}