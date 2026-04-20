import { ajv, validateSchema } from "../../util/validation"
import { canGenerateReport, decrementGenerationsLeft, sendReport } from "../base/user"
import { Request, Response } from "express"
import { fieldKeyToName, generateUserReport, getAvatarString, getDescription, isValidCustomFieldType, typeConverters } from "../base/user/generateReports"
import xss from "xss"
import { readFile } from "fs"
import { promisify } from "util"
import { intersects } from "../../util"
import { getCollection, parseId } from "../../modules/mongo"
import { ObjectId } from "mongodb"
import { applyBrandingReplacements } from "../../modules/mail/mailTemplates"

const performReportGeneration = async (req: Request, res: Response) => {
	const getFile = promisify(readFile)
	const loadTemplate = async (path: string) => applyBrandingReplacements(await getFile(path, "utf-8"))

	const fieldsTemplate = await loadTemplate("./templates/members/reportCustomFields.html")
	const fieldTemplate = await loadTemplate("./templates/members/reportCustomField.html")
	const descTemplate = await loadTemplate("./templates/reportDescription.html")

	const query: { [key: string]: any } = req.body

	const memberBuckets = query?.members?.buckets ?? []
	const cfBuckets = query?.customFronts?.buckets ?? []
	const fhMemberBuckets = query?.frontHistory?.memberBuckets ?? []
	const fhCustomFrontsBuckets = query?.frontHistory?.customFrontBuckets ?? []

	const fieldSpecs = await getCollection("customFields").find({ uid: res.locals.uid }).toArray()

	const createMember = async (query: { [key: string]: any }, template: string, memberData: any) => {
		const localMemberBuckets: any[] = memberData.buckets ?? []

		// Check if there's an intersection between the buckets allowed on this part of the request (`memberBuckets`), and the buckets assigned to this member (`localMemberBuckets`)
		// If no, still allow access if the user selected the "Include those without buckets assigned" checkbox on this part of the request
		if (localMemberBuckets.length > 0) {
			if (!intersects(memberBuckets, localMemberBuckets)) {
				return { show: false, result: "" }
			}
		} else {
			if (query.members.includeBucketless !== true) {
				return { show: false, result: "" }
			}
		}

		let member = `${template}`

		member = member.replace("{{name}}", xss(memberData.name))
		member = member.replace("{{pronouns}}", xss(memberData.pronouns ?? ""))
		member = member.replace("{{color}}", xss(memberData.color))
		member = member.replace("{{avatar}}", xss(getAvatarString(memberData, res.locals.uid)))
		member = member.replace("{{privacy}}", xss(`${localMemberBuckets.length} Bucket(s)`))
		member = member.replace("{{desc}}", getDescription(memberData, descTemplate, memberData.supportDescMarkdown ?? true))

		if (query.members.includeCustomFields === false) {
			member = member.replace("{{fields}}", "")
		} else {
			if (memberData.info) {
				let fields = `${fieldsTemplate}`

				// Prepare an array to store populated custom fields in, so they can be sorted later.
				let populatedFields: any[] = []

				for (const [key, value] of Object.entries(memberData.info)) {
					const strValue: string = value as string
					if (value && strValue.length > 0) {
						// Check if the custom field is known in the list of all field specifications for this user. Skip field if not.
						const fieldSpecIndex = fieldSpecs.findIndex((spec) => (parseId(spec._id) as ObjectId).equals(parseId(key)))

						if (fieldSpecIndex == -1) {
							continue
						}

						const fieldSpec = fieldSpecs[fieldSpecIndex]
						const fieldBuckets: any[] = fieldSpec.buckets ?? []

						// Check if there's an intersection between the buckets allowed on this request (`memberBuckets`), and the buckets assigned to this field (`fieldBuckets`)
						// If either has no bucket assigned, don't skip them just yet, but check if the "include those without buckets assigned" checkbox was checked.
						if (memberBuckets.length > 0 && fieldBuckets.length > 0) {
							if (!intersects(fieldBuckets, memberBuckets)) {
								// each have buckets set, but no intersection -> skip
								continue
							}
							// each have buckets set and intersects; running as expected
						} else {
							if (query.members.includeBucketless !== true) {
								// either this member of this field is not in any bucket, and we don't allow fields or members without buckets to be shown -> skip
								continue
							}
							// either this member or this field is not in any buckets, but we are allowed to show members or fields without buckets
						}

						// Check if the custom field has a known type defined, if not skip
						if (!isValidCustomFieldType(fieldSpec.type)) {
							continue
						}

						const valueConverted = typeConverters[fieldSpec.type](value as string, fieldSpec.supportMarkdown ?? true)
						if (valueConverted) {
							let field = `${fieldTemplate}`
							const keyName = xss(fieldSpec.name)
							if (keyName.length > 0) {
								field = field.replace("{{key}}", keyName)
								field = field.replace("{{value}}", valueConverted)
								// Sort the fields later on once they've all been populated
								populatedFields.push({
									order: fieldSpec.order,
									field: field
								})
							}
						}
					}
				}

				if (populatedFields.length > 0) {
					// Sort fields based on the order shown in the app; replicated from app code lib/pages/members/systemMemberData.dart
					populatedFields.sort((a, b) => {
						return (a.order ?? 0) < (b.order ?? 0) ? -1 : 1
					})

					let populatedFieldsContents = ""
					populatedFields.forEach((populatedField) => {
						populatedFieldsContents += populatedField.field
					})

					fields = fields.replace("{{fields}}", populatedFieldsContents)
					member = member + fields
				}
			}
		}

		return { show: true, result: member }
	}

	const createCustomFront = async (query: { [key: string]: any }, template: string, frontData: any) => {
		const localCfBuckets: any[] = frontData.buckets ?? []

		if (localCfBuckets.length > 0) {
			if (!intersects(cfBuckets, localCfBuckets)) {
				return { show: false, result: "" }
			}
		} else {
			if (query.customFronts.includeBucketless !== true) {
				return { show: false, result: "" }
			}
		}

		let customFront = `${template}`

		customFront = customFront.replace("{{name}}", xss(frontData.name))
		customFront = customFront.replace("{{color}}", xss(frontData.color))
		customFront = customFront.replace("{{avatar}}", xss(getAvatarString(frontData, frontData.uid)))
		customFront = customFront.replace("{{privacy}}", xss(`${localCfBuckets.length} Buckets`))
		customFront = customFront.replace("{{desc}}", getDescription(frontData, descTemplate, frontData.supportDescMarkdown ?? true))
		return { show: true, result: customFront }
	}

	const shouldShowFrontEntry = (query: { [key: string]: any }, memberData: any, isMember: boolean) => {
		const localBuckets: any[] = memberData.buckets ?? []

		if (localBuckets.length > 0) {
			if (!intersects(isMember ? fhMemberBuckets : fhCustomFrontsBuckets, localBuckets)) {
				return { show: false }
			}
		} else {
			if (isMember) {
				if (query.frontHistory.includeMembersBucketless !== true) {
					return { show: false }
				}
			} else {
				if (query.frontHistory.includeCustomFrontsBucketless !== true) {
					return { show: false }
				}
			}
		}

		return { show: true }
	}

	const htmlFile = await generateUserReport(req.body, res.locals.uid, createMember, createCustomFront, shouldShowFrontEntry)
	sendReport(req, res, htmlFile)
}

export const generateReport = async (req: Request, res: Response) => {
	const canGenerate = await canGenerateReport(res)
	if (canGenerate) {
		performReportGeneration(req, res)
		decrementGenerationsLeft(res.locals.uid)
	} else {
		res.status(403).send("You do not have enough generations left in order to generate a new report")
	}
}

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
				includeMembersBucketless: { type: "boolean" },
				includeCustomFrontsBucketless: { type: "boolean" },
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
				includeBucketless: { type: "boolean" },
				buckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
			},
			required: ["buckets", "includeBucketless", "includeCustomFields"],
		},
		customFronts: {
			nullable: true,
			type: "object",
			properties: {
				includeBucketless: { type: "boolean" },
				buckets: { type: "array", items: { type: "string", pattern: "^[A-Za-z0-9]{20,50}$" }, uniqueItems: true },
			},
			required: ["buckets", "includeBucketless"],
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["sendTo"],
}
const v_validateUserReportSchema = ajv.compile(s_validateUserReportSchema)

export const validateUserReportSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateUserReportSchema, body)
}
