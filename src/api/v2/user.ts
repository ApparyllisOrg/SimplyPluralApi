import { ajv, validateSchema } from "../../util/validation";
import { canGenerateReport, decrementGenerationsLeft, sendReport } from "../base/user";
import { Request, Response } from "express";
import { fieldKeyToName, generateUserReport, getAvatarString, getDescription, typeConverters } from "../base/user/generateReports";
import xss from "xss";
import { readFile } from "fs";
import { promisify } from "util";
import { intersects } from "../../util";
import { getCollection, parseId } from "../../modules/mongo";
import { ObjectId } from "mongodb";

const performReportGeneration = async (req: Request, res: Response) => {

    const getFile = promisify(readFile);

	const fieldsTemplate = await getFile("./templates/members/reportCustomFields.html", "utf-8");
	const fieldTemplate = await getFile("./templates/members/reportCustomField.html", "utf-8");
    const descTemplate = await getFile("./templates/reportDescription.html", "utf-8");

    const query: { [key: string]: any } = req.body

    const memberBuckets = query?.members?.buckets ?? []
    const cfBuckets = query?.customFronts?.buckets ?? []
    const fhMemberBuckets = query?.frontHistory?.memberBuckets ?? []
    const fhCustomFrontsBuckets = query?.frontHistory?.customFrontBuckets ?? []

    const fieldSpecs = await getCollection("customFields").find({uid: res.locals.uid}).toArray()

    const createMember = async (query: { [key: string]: any }, template: string, memberData: any) =>
    {
        const localMemberbuckets : any[] = memberData.buckets ?? []

        if (localMemberbuckets.length > 0)
        {
            if (!intersects(memberBuckets, localMemberbuckets)) {
                return {show: false, result: ''};
            }
        } else 
        {
            if (query.members.includeBucketless !== true)
            {
                return {show: false, result: ''};
            }
        }

        let member = `${template}`;

        member = member.replace("{{name}}", xss(memberData.name));
        member = member.replace("{{pronouns}}", xss(memberData.pronouns ?? ""));
        member = member.replace("{{color}}", xss(memberData.color));
        member = member.replace("{{avatar}}", xss(getAvatarString(memberData, res.locals.uid)));
        member = member.replace("{{privacy}}", xss(`${localMemberbuckets.length} Buckets`));
        member = member.replace("{{desc}}", getDescription(memberData, descTemplate, memberData.supportDescMarkdown ?? true));

        if (query.members.includeCustomFields === false) {
            member = member.replace("{{fields}}", "");
        } else {
            if (memberData.info) {
                let fields = `${fieldsTemplate}`;
                let generatedFields = "";
                for (const [key, value] of Object.entries(memberData.info)) {

                    const strValue: string = value as string;
                    if (value && strValue.length > 0) {
                        const fieldSpecIndex = fieldSpecs.findIndex((spec) => (parseId(spec._id) as ObjectId).equals(parseId(key)))          
                     
                        if (fieldSpecIndex == -1)
                        {
                            continue
                        }     

                        const fieldSpec = fieldSpecs[fieldSpecIndex]
                        const fieldBuckets : any[]= fieldSpec.buckets ?? []

                        if (!intersects(fieldBuckets, memberBuckets)) {
                            continue
                        }

                        const fieldResult = typeConverters[fieldSpec.type](value as string, fieldSpec.supportMarkdown ?? true);
                        if (fieldResult) {
                            let field = `${fieldTemplate}`;
                            const valueText = xss(fieldSpec.name);
                            if (valueText.length > 0) {
                                field = field.replace("{{key}}", valueText);
                                field = field.replace("{{value}}", fieldResult);
                                generatedFields = generatedFields + field;
                            }
                        }
                    }
                }

                if (generatedFields.length > 0) {
                    fields = fields.replace("{{fields}}", generatedFields);
                    member = member + fields;
                }
            }
        }

        return {show: true, result: member}
    }

    const createCustomFront = async (query: { [key: string]: any }, template: string, frontData: any) =>
    {
        const localCfBuckets : any[] = frontData.buckets ?? []

        if (localCfBuckets.length > 0)
        {
            if (!intersects(cfBuckets, localCfBuckets)) {
                return {show: false, result: ''};
            }
        } else 
        {
            if (query.customFronts.includeBucketless !== true)
            {
                return {show: false, result: ''};
            }
        }

        let customFront = `${template}`;

        customFront = customFront.replace("{{name}}", xss(frontData.name));
        customFront = customFront.replace("{{color}}", xss(frontData.color));
        customFront = customFront.replace("{{avatar}}", xss(getAvatarString(frontData, frontData.uid)));
        customFront = customFront.replace("{{privacy}}", xss(`${localCfBuckets.length} Buckets`));
        customFront = customFront.replace("{{desc}}", getDescription(frontData, descTemplate, frontData.supportDescMarkdown ?? true));
        return {show: true, result: customFront}
    }

    const shouldShowFrontEntry = (query: { [key: string]: any }, memberData: any, isMember: boolean) =>
    {
        const localBuckets : any[] = memberData.buckets ?? []

        if (localBuckets.length > 0)
        {
            if (!intersects(isMember ? fhMemberBuckets : fhCustomFrontsBuckets, localBuckets)) {
                return { show: false };
            }
        } 
        else 
        {
            if (isMember)
            {
                if (query.frontHistory.includeMembersBucketless !== true)
                {
                    return { show: false };
                }
            }
            else 
            {
                if (query.frontHistory.includeCustomFrontsBucketless !== true)
                {
                    return { show: false };
                }
            }
        }

        return { show: true }
    }

	const htmlFile = await generateUserReport(req.body, res.locals.uid, createMember, createCustomFront, shouldShowFrontEntry );
    sendReport(req, res, htmlFile)
    decrementGenerationsLeft(res.locals.uid);
};

export const generateReport = async (req: Request, res: Response) => {
	const canGenerate = await canGenerateReport(res);
	if (canGenerate) {
		performReportGeneration(req, res);
		decrementGenerationsLeft(res.locals.uid);
	} else {
		res.status(403).send("You do not have enough generations left in order to generate a new report");
	}
};

const s_validateUserReportSchema = {
    type: "object",
    properties: {
        sendTo: {
            type: "string",
            format: "email",
        },
        cc: {
            type: "array",
            items: { type: "string", format: "fullEmail" },
        },
        frontHistory: {
            nullable: true,
            type: "object",
            properties: {
                start: { type: "number" },
                end: { type: "number" },
                includeMembers: { type: "boolean" },
                includeCustomFronts: { type: "boolean" },
                includeMembersBucketless: {type: "boolean"},
                includeCustomFrontsBucketless: {type: "boolean"},
                memberBuckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
                customFrontBuckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
                
            },
            required: ["memberBuckets", "customFrontBuckets", "includeMembersBucketless", "includeCustomFrontsBucketless", "includeMembers", "includeCustomFronts", "start", "end"],
        },
        members: {
            nullable: true,
            type: "object",
            properties: {
                includeCustomFields: { type: "boolean" },
                includeBucketless: {type: "boolean"},
                buckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
            },
            required: ["buckets", "includeBucketless", "includeCustomFields"],
        },
        customFronts: {
            nullable: true,
            type: "object",
            properties: {
                includeBucketless: {type: "boolean"},
                buckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
            },
            required: ["buckets", "includeBucketless"],
        },
    },
    nullable: false,
    additionalProperties: false,
    required: ["sendTo"],
};
const v_validateUserReportSchema = ajv.compile(s_validateUserReportSchema)

export const validateUserReportSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateUserReportSchema, body);
};