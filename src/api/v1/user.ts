import { Request, Response } from "express"
import { logger, userLog } from "../../modules/logger"
import { db, getCollection, parseId } from "../../modules/mongo"
import { fetchCollection, getDocumentAccess, sendDocument } from "../../util"
import { ajv, getAvatarUuidSchema, validateSchema } from "../../util/validation"
import { generateUserReport } from "./user/generateReport"
import { update122 } from "./user/updates/update112"
import { auth } from "firebase-admin"
import { canSeeMembers, getFriendLevel, isTrustedFriend, logSecurityUserEvent } from "../../security"
import moment from "moment"
import * as minio from "minio"
import * as Sentry from "@sentry/node"
import { ERR_FUNCTIONALITY_EXPECTED_VALID } from "../../modules/errors"
import { createUser } from "./user/migrate"
import { exportData, fetchAllAvatars } from "./user/export"
import { getEmailForUser } from "./auth/auth.core"
import { frameType } from "../types/frameType"
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./user/updates/updateUser"
import { canGenerateReport, decrementGenerationsLeft, reportBaseUrl, reportBaseUrl_V2, sendReport } from "../base/user"
import archiver, { Archiver } from "archiver"
import promclient from "prom-client"

import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"

const s3 = new S3Client({
	endpoint: process.env.OBJECT_HOST ?? "",
	region: process.env.OBJECT_REGION ?? "none",
	credentials: { accessKeyId: process.env.OBJECT_KEY ?? "", secretAccessKey: process.env.OBJECT_SECRET ?? "" },
})

const minioClient = new minio.Client({
	endPoint: "localhost",
	port: 9001,
	useSSL: false,
	accessKey: process.env.MINIO_KEY!,
	secretKey: process.env.MINIO_SECRET!,
})

export const generateReport = async (req: Request, res: Response) => {
	const canGenerate = await canGenerateReport(res)
	if (canGenerate) {
		performReportGeneration(req, res)
		decrementGenerationsLeft(res.locals.uid)
	} else {
		res.status(403).send("You do not have enough generations left in order to generate a new report")
	}
}
const events_counter_reports = new promclient.Counter({
	name: "apparyllis_api_generated_reports",
	help: "Counter for generated reports",
})

const performReportGeneration = async (req: Request, res: Response) => {
	events_counter_reports.inc()
	const htmlFile = await generateUserReport(req.body, res.locals.uid)
	sendReport(req, res, htmlFile)
}

export const getReports = async (req: Request, res: Response) => {
	fetchCollection(req, res, "reports", {})
}

export const deleteReport = async (req: Request, res: Response) => {
	const report = await getCollection("reports").findOne({ uid: res.locals.uid, _id: parseId(req.params.reportid) })

	const url: string = report.url

	let reportPath = url.replace(reportBaseUrl, "")
	reportPath = url.replace(reportBaseUrl_V2, "")

	minioClient
		.removeObject("spaces", `reports/${res.locals.uid}/${reportPath}`)
		.then(() => {
			getCollection("reports").deleteMany({ uid: res.locals.uid, _id: parseId(req.params.reportid) })
			res.status(200).send({ success: true })
		})
		.catch((e) => {
			logger.error(e)
			res.status(500).send("Error deleting report")
		})
}

export const getMe = async (req: Request, res: Response) => {
	const document = await getCollection("users").findOne({ uid: res.locals.uid })
	sendDocument(req, res, "users", document)
}

export const get = async (req: Request, res: Response) => {
	let document = await getCollection("users").findOne({ uid: req.params.id })

	const ownDocument = req.params.id === res.locals.uid

	if (!document && !ownDocument) {
		return res.status(404).send("User document does not exist")
	}

	// create the user
	if (!document && ownDocument) {
		await createUser(res.locals.uid, null)
		document = await getCollection("users").findOne({ uid: res.locals.uid })
	}

	// initialize custom fields for the user
	if (!document.fields && ownDocument) {
		await initializeCustomFields(res.locals.uid)
		document = await getCollection("users").findOne({ uid: res.locals.uid })
	}

	if (!document) {
		Sentry.setExtra("payload", res.locals.uid)
		Sentry.captureMessage(`ErrorCode(${ERR_FUNCTIONALITY_EXPECTED_VALID})`)
		res.status(400)
		return
	}

	// Remove fields that aren't shared to the friend
	if (req.params.id !== res.locals.uid) {
		const newFields: any = {}

		const canSee = await canSeeMembers(req.params.id, res.locals.uid)
		if (canSee) {
			const hasMigrated = await doesUserHaveVersion(req.params.id, FIELD_MIGRATION_VERSION)
			if (hasMigrated) {
				const userFields = await getCollection("customFields").find({ uid: req.params.id }).toArray()

				for (let i = 0; i < userFields.length; ++i) {
					const field = userFields[i]
					const accessResult = await getDocumentAccess(res.locals.uid, field, "customFields")
					if (accessResult.access === true) {
						newFields[field._id.toString()] = { name: field.name, order: field.order, type: field.type }
					}
				}
			} // Legacy custom fields
			else {
				const friendLevel = await getFriendLevel(req.params.id, res.locals.uid)
				const isATrustedFriends = isTrustedFriend(friendLevel)

				if (document.fields) {
					Object.keys(document.fields).forEach((key: string) => {
						const field = document.fields[key]
						if (field.private === true && field.preventTrusted === false && isATrustedFriends) {
							newFields[key] = field
						}
						if (field.private === false && field.preventTrusted === false) {
							newFields[key] = field
						}
					})
				}
			}
		}

		document.fields = newFields
	}

	sendDocument(req, res, "users", document)
}

export const update = async (req: Request, res: Response) => {
	const setBody = req.body
	setBody.lastOperationTime = res.locals.operationTime

	const userMigrated = await doesUserHaveVersion(res.locals.uid, FIELD_MIGRATION_VERSION)
	if (userMigrated) {
		delete setBody.fields
	}

	await getCollection("users").updateOne(
		{
			uid: res.locals.uid,
			$or: [{ lastOperationTime: null }, { lastOperationTime: { $lte: res.locals.operationTime } }],
		},
		{ $set: setBody }
	)
	res.status(200).send()
}

export const SetUsername = async (req: Request, res: Response) => {
	const newUsername: string = req.body["username"].trim()

	if (newUsername.length < 3) {
		res.status(400).send({ success: false, msg: "Username must be at least 3 characters" })
		return
	}

	const potentiallyAlreadyTakenUserDoc = await getCollection("users").findOne({ username: { $regex: "^" + newUsername + "$", $options: "i" }, uid: { $ne: res.locals.uid } })

	if (potentiallyAlreadyTakenUserDoc === null) {
		const user = await getCollection("users").findOne({ uid: res.locals.uid })
		getCollection("users").updateOne({ uid: res.locals.uid }, { $set: { username: newUsername } })
		res.status(200).send({ success: true })

		logSecurityUserEvent(res.locals.uid, "Changed username to: " + newUsername, req)

		userLog(res.locals.uid, "Updated username to: " + newUsername + ", changed from " + user.username)
	} else {
		res.status(200).send({ success: false, msg: "This username is already taken" })
	}
}

const deleteUploadedUserFolder = async (uid: string, prefix: string) => {
	const deleteFolderPromise = new Promise<any>(async (resolve) => {
		const recursiveDelete = async (token: string | undefined) => {
			const params = {
				Bucket: "simply-plural",
				Prefix: `${prefix}/${uid}/`,
				ContinuationToken: token,
			}

			try {
				let listCommand = new ListObjectsV2Command(params)

				const list = await s3.send(listCommand)

				if (list.NextContinuationToken) {
					await recursiveDelete(list.NextContinuationToken)
				}

				if (list.KeyCount && list.Contents) {
					let deleteCommand = new DeleteObjectsCommand({
						Bucket: "simply-plural",
						Delete: {
							Objects: list.Contents.map((item) => ({ Key: item.Key ?? "" })),
						},
					})

					await s3.send(deleteCommand)
				}
			} catch (e) {
				logger.log("error", e)
			}
		}

		await recursiveDelete(undefined)

		const listedObjects = await minioClient.listObjectsV2("spaces", `/${prefix}/${uid}/`)
		if (listedObjects) {
			const list: minio.BucketItem[] = []
			const toDeleteList: string[] = []

			listedObjects.on("data", function (item) {
				list.push(item)
			})

			listedObjects.on("error", function () {
				resolve(false)
			})

			listedObjects.on("end", async function () {
				list.forEach(({ name }) => {
					if (name) {
						toDeleteList.push(name)
					}
				})

				userLog(uid, `Deleting ${toDeleteList.length.toString()} of type ${prefix} in storage`)

				await minioClient.removeObjects("spaces", toDeleteList)

				userLog(uid, `Deleted ${toDeleteList.length.toString()} of type ${prefix} in storage`)

				resolve(true)
			})
		}
	})
	await deleteFolderPromise
}

export const deleteAccount = async (req: Request, res: Response) => {
	const perform: boolean = req.body["performDelete"]

	if (!perform) {
		res.status(202).send()
		return
	}

	let email = await getEmailForUser(res.locals.uid)

	const userDoc = await getCollection("users").findOne({ uid: res.locals.uid, _id: res.locals.uid })
	const username = userDoc?.username ?? ""

	const collections = await db()!.listCollections().toArray()

	collections.forEach(async (collection) => {
		const name: string = collection.name
		const split = name.split(".")
		const actualName = split[split.length - 1]

		await getCollection(actualName).deleteMany({ uid: res.locals.uid })
	})

	await getCollection("friends").deleteMany({ frienduid: res.locals.uid })
	await getCollection("pendingFriendRequests").deleteMany({ receiver: { $eq: res.locals.uid } })
	await getCollection("pendingFriendRequests").deleteMany({ sender: { $eq: res.locals.uid } })

	// Don't delete avatars and reports when deleting pretesting
	if (process.env.PRETESTING !== "true") {
		{
			await deleteUploadedUserFolder(res.locals.uid, "reports")
			await deleteUploadedUserFolder(res.locals.uid, "avatars")
		}
	}

	userLog(res.locals.uid, `Pre Delete User ${email} and username ${username}`)

	if (process.env.PRETESTING !== "true") {
		auth()
			.deleteUser(res.locals.uid)
			.catch((r) => undefined)
		userLog(res.locals.uid, `Post Delete Firebase User ${email} and username ${username}`)
	}

	userLog(res.locals.uid, `Post Delete User ${email} and username ${username}`)

	res.status(200).send()
}

export const exportUserData = async (_req: Request, res: Response) => {
	const result = await exportData(res.locals.uid)
	if (!result.success) {
		res.status(result.code).send(result.msg)
		return
	}

	const email = await getEmailForUser(res.locals.uid)

	await getCollection("private").updateOne({ uid: res.locals.uid, _id: res.locals.uid }, { $set: { lastExport: moment.now() } })
	logSecurityUserEvent(res.locals.uid, "Exported user account", _req)

	res.status(200).send({ success: true })
	userLog(res.locals.uid, `Exported user data and sent to ${email}.`)
}

export const exportAvatars = async (req: Request, res: Response) => {
	const requestedExport = await getCollection("avatarExports").findOne({ uid: req.query.uid, key: req.query.key, exp: { $gte: moment.now() } })
	if (!requestedExport) {
		res.status(400).send("Cannot find the requested export")
		return
	}

	const filename = `Avatars_${req.query.uid}.zip`

	res.setHeader("Content-Type", "application/zip")
	res.setHeader("Content-disposition", 'attachment; filename="' + filename + '"')

	const arch = archiver("zip")

	arch.pipe(res)

	await fetchAllAvatars(req.query.uid?.toString() ?? "", async (name: String, data: Buffer) => {
		arch.append(data, { name: name + ".png" })
	})

	arch.finalize()

	logSecurityUserEvent(res.locals.uid, "Exported user avatars", req)

	res.status(200)
}

export const setupNewUser = async (uid: string, latestVersion: number | null) => {
	const friendData: { uid: string; name: string; icon: string; rank: string; desc: string; color: string; _id?: any } = {
		uid,
		name: "Friends",
		icon: "🔓",
		rank: "0|aaaaaa:",
		desc: "A bucket for all your friends",
		color: "#C99524",
	}
	const trustedFriendData: { uid: string; name: string; icon: string; rank: string; desc: string; color: string; _id?: any } = {
		uid,
		name: "Trusted friends",
		icon: "🔒",
		rank: "0|zzzzzz:",
		desc: "A bucket for all your trusted friends",
		color: "#1998A8",
	}

	await getCollection("privacyBuckets").insertOne(friendData)
	await getCollection("privacyBuckets").insertOne(trustedFriendData)

	userLog(uid, "Setup new user account")

	await createUser(uid, latestVersion)
}

export const initializeCustomFields = async (uid: string) => {
	const userDoc = await getCollection("users").findOne({ uid: uid })
	if (userDoc["fields"]) {
		// Already have fields, don't setup!
		return
	}

	const memberWithFields = await getCollection("members").findOne({ uid: uid, info: { $exists: true } }, { projection: { _id: 1 } })
	if (memberWithFields) {
		update122(uid)
	}
}

const s_validateUserSchema = {
	type: "object",
	properties: {
		desc: { type: "string" },
		isAsystem: { type: "boolean" },
		avatarUuid: getAvatarUuidSchema(),
		avatarUrl: { type: "string" },
		color: { type: "string" },
		supportDescMarkdown: { type: "boolean" },
		fields: {
			type: "object",
			patternProperties: {
				"^[0-9A-z]{22,23}$": {
					type: "object",
					properties: {
						name: { type: "string" },
						order: { type: "number" },
						private: { type: "boolean" },
						preventTrusted: { type: "boolean" },
						type: { type: "number" },
						supportMarkdown: { type: "boolean" },
					},
					required: ["name", "order", "private", "preventTrusted", "type"],
				},
			},
			additionalProperties: false,
		},
		frame: frameType,
	},
	nullable: false,
	additionalProperties: false,
}

const v_validateUserSchema = ajv.compile(s_validateUserSchema)

export const validateUserSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateUserSchema, body)
}

const s_validateUsernameSchema = {
	type: "object",
	properties: {
		username: { type: "string", pattern: "^[a-zA-Z0-9-_]{1,35}$" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["username"],
}
const v_validateUsernameSchema = ajv.compile(s_validateUsernameSchema)

export const validateUsernameSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateUsernameSchema, body)
}

const s_validateExportAvatarsSchema = {
	type: "object",
	properties: {
		key: { type: "string", pattern: "^[a-zA-Z0-9-_]{256}$" },
		uid: { type: "string", pattern: "^[a-zA-Z0-9]{20,64}$" },
	},
	nullable: false,
	additionalProperties: false,
	required: ["key", "uid"],
}
const v_validateExportAvatarsSchema = ajv.compile(s_validateExportAvatarsSchema)

export const validateExportAvatarsSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateExportAvatarsSchema, body)
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
				privacyLevel: { type: "number" },
			},
			required: ["privacyLevel", "includeMembers", "includeCustomFronts", "start", "end"],
		},
		members: {
			nullable: true,
			type: "object",
			properties: {
				includeCustomFields: { type: "boolean" },
				privacyLevel: { type: "number" },
			},
			required: ["privacyLevel", "includeCustomFields"],
		},
		customFronts: {
			nullable: true,
			type: "object",
			properties: {
				privacyLevel: { type: "number" },
			},
			required: ["privacyLevel"],
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
