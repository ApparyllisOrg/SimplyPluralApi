import { nanoid } from "nanoid"
import { getCollection } from "../../modules/mongo"
import { Request, Response } from "express"
import { getTemplate, mailTemplate_userReport } from "../../modules/mail/mailTemplates"
import moment from "moment"
import { logger } from "../../modules/logger"
import { sendCustomizedEmailToEmail } from "../../modules/mail"
import { ObjectCannedACL, PutObjectCommand } from "@aws-sdk/client-s3"
import { storageController } from "../../modules/storage/storageController"
import { config } from "../../modules/config"

export const reportBaseUrl = () => `${config().storage?.legacyBaseUrl ?? config().storage?.baseUrl ?? ""}/`
export const reportBaseUrl_V2 = () => `${config().storage?.baseUrl ?? ""}/`

export const decrementGenerationsLeft = async (uid: string) => {
	const user: any | null = await getCollection("users").findOne({ uid, _id: uid })
	const patron: boolean = user?.patron ?? false

	const privateDoc = await getCollection("private").findOne({ uid, _id: uid })
	if (privateDoc.generationsLeft) {
		await getCollection("private").updateOne({ uid, _id: uid }, { $inc: { generationsLeft: -1 } })
	} else {
		await getCollection("private").updateOne({ uid, _id: uid }, { $set: { generationsLeft: patron ? 10 : 3 } })
	}
}

export const canGenerateReport = async (res: Response): Promise<boolean> => {
	const privateDoc = await getCollection("private").findOne({ uid: res.locals.uid, _id: res.locals.uid })
	if (privateDoc) {
		if ((privateDoc.generationsLeft && privateDoc.generationsLeft > 0) || !privateDoc.generationsLeft) {
			return true
		}
		return privateDoc.bypassGenerationLimit === true
	}

	return true
}

export const sendReport = async (req: Request, res: Response, htmlFile: string) => {
	const randomId = await nanoid(32)
	const randomId2 = await nanoid(32)
	const randomId3 = await nanoid(32)

	const path = `reports/${res.locals.uid}/${randomId}/${randomId2}/${randomId3}.html`

	const reportUrl = reportBaseUrl_V2() + path

	let emailTemplate = await getTemplate(mailTemplate_userReport())

	emailTemplate = emailTemplate.replace("{{reportUrl}}", reportUrl)

	sendCustomizedEmailToEmail(req.body.sendTo, emailTemplate, "Your user report", req.body.cc)

	getCollection("reports").insertOne({ uid: res.locals.uid, url: reportUrl, createdAt: moment.now(), usedSettings: req.body })

	const result = await storageController?.put(path, Buffer.from(htmlFile), { s3: { ACL: ObjectCannedACL.public_read } })

	if (result) {
		res.status(200).send({ success: true, msg: reportUrl })
	} else {
		res.status(500).send("Error uploading report")
	}
}
