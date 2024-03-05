import { Request, Response } from "express";
import moment from "moment";
import { frontChange } from "../../modules/events/frontChange";
import { getCollection, parseId } from "../../modules/mongo";
import { canAccessDocument, canSeeMembers, getFriendLevel, isTrustedFriend } from "../../security";
import { addSimpleDocument, deleteSimpleDocument, fetchSimpleDocument, sendDocument, sendDocuments, updateSimpleDocument } from "../../util";
import { getPrivacyDependency, validateSchema } from "../../util/validation";
import { frameType } from "../types/frameType";
import { getDefaultPrivacyBuckets } from "../v1/private";
import { ObjectId } from "mongodb";
import { transformBucketListToBucketIds } from "../v1/privacy/privacy.bucket.set";

export const getMembers = async (req: Request, res: Response) => {
	if (req.params.system != res.locals.uid) {
		const canSee = await canSeeMembers(req.params.system, res.locals.uid);
		if (!canSee) {
			res.status(403).send("You are not authorized to see members of this user");
			return;
		}
	}

	const query = getCollection("members").find({ uid: req.params.system });
	const documents = await query.toArray();

	if (req.params.system != res.locals.uid) {
		const ownerUser = await getCollection("users").findOne({ uid: req.params.system });
		const friendLevel = await getFriendLevel(req.params.system, res.locals.uid);
		const isATrustedFriend = isTrustedFriend(friendLevel);
		if (ownerUser) {
			const ownerFields: { [key: string]: any } = ownerUser.fields;
			documents.forEach((member) => {
				const newFields: any = {};

				if (member.info && ownerFields) {
					Object.keys(member.info).forEach((key) => {
						const fieldSpec = ownerFields[key];
						if (fieldSpec) {
							if (fieldSpec.private === true && fieldSpec.preventTrusted === false && isATrustedFriend) {
								newFields[key] = member.info[key] ?? "";
							}
							if (fieldSpec.private === false && fieldSpec.preventTrusted === false) {
								newFields[key] = member.info[key] ?? "";
							}
						}
					});
				}

				member.info = newFields;
			});
		} else {
			res.status(404).send();
			return;
		}
	}
	sendDocuments(req, res, "members", documents);
};

export const get = async (req: Request, res: Response) => {
    const document = await getCollection("members").findOne({ _id: parseId(req.params.id), uid: req.params.system ?? res.locals.uid });

    if (!document)
    {
        res.status(404).send()
        return
    }

    if (res.locals.uid !== document.uid)
    {
        const fields : ObjectId[] = []
        const info : { _id: string | ObjectId, value: string }[] =  document.info

        const allowedInfo: { _id: string | ObjectId, value: string }[] = []
        
        for (let i = 0; i < info.length; ++i)
        {
            if (canAccessDocument(res.locals.uid, ))
        }

        info.forEach((infoEntry) => 
        {
            fields.push(parseId(infoEntry._id))
        })

        const mongoBucketIds = await transformBucketListToBucketIds(res.locals.uid, fields)
        const buckets = await getCollection(req.body.type).updateOne({ uid: res.locals.uid, _id : parseId(req.body.id) }, { $set: { buckets: mongoBucketIds } })
    }
    else 
    {
        sendDocument(req, res, "members", document)
    }
};

export const add = async (req: Request, res: Response) => {
    req.body.buckets = getDefaultPrivacyBuckets(res.locals.uid, "members")

	addSimpleDocument(req, res, "members");
};

export const update = async (req: Request, res: Response) => {
	updateSimpleDocument(req, res, "members");

	// If this member is fronting, we need to notify and update current fronters
	const fhLive = await getCollection("frontHistory").findOne({ uid: res.locals.uid, member: req.params.id, live: true });
	if (fhLive) {
		frontChange(res.locals.uid, false, req.params.id, false);
	}
};

export const validateMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			pronouns: { type: "string" },
			pkId: { type: "string" },
			color: { type: "string" },
			avatarUuid: { type: "string" },
			avatarUrl: { type: "string" },
			preventsFrontNotifs: { type: "boolean" },
			info: {
				type: "array",
                items: {
                    type: "object",
                    properties: {
                        _id: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$"},
                        value: { type: "string" },
                    }
                }
			},
			supportDescMarkdown: { type: "boolean" },
			archived: { type: "boolean" },
			receiveMessageBoardNotifs: { type: "boolean" },
			archivedReason: { type: "string", maxLength: 150 },
			frame: frameType

		},
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};

export const validatePostMemberSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			name: { type: "string" },
			desc: { type: "string" },
			pronouns: { type: "string" },
			pkId: { type: "string" },
			color: { type: "string" },
			avatarUuid: { type: "string" },
			avatarUrl: { type: "string" },
			preventsFrontNotifs: { type: "boolean" },
            info: {
				type: "array",
                items: {
                    type: "object",
                    properties: {
                        _id: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$"},
                        value: { type: "string" },
                    }
                }
			},
			supportDescMarkdown: { type: "boolean" },
			archived: { type: "boolean" },
			receiveMessageBoardNotifs: { type: "boolean" },
			archivedReason: { type: "string", maxLength: 150 },
			frame: frameType
		},
		required: ["name"],
		nullable: false,
		additionalProperties: false,
		dependencies: getPrivacyDependency(),
	};

	return validateSchema(schema, body);
};
