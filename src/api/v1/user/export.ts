import { randomBytes } from "crypto"
import { readFile } from "fs"
import moment from "moment"
import { promisify } from "util"
import { sendCustomizedEmail } from "../../../modules/mail"
import { db, getCollection } from "../../../modules/mongo"
import { storageController } from "../../../modules/storage/storageController"
import { decryptMessage } from "../chat/chat.core"
import { config } from "../../../modules/config"

//-------------------------------//
// Fetch all avatars from a user
//-------------------------------//
export const fetchAllAvatars = async (uid: string, processAvatar: (name: string, data: Buffer) => Promise<void>): Promise<void> => {
	const members = await getCollection("members")
		.find({ uid }, { projection: { _id: 1, avatarUuid: 1 } })
		.toArray()

	for (let i = 0; i < members.length; ++i) {
		const member = members[i]
		if (member.avatarUuid) {
			const avatar = await storageController?.get(`avatars/${uid}/${member.avatarUuid}`)
			if (avatar) {
				await processAvatar(member._id.toString(), avatar)
			}
		}
	}

	const cfs = await getCollection("frontStatuses")
		.find({ uid }, { projection: { _id: 1, avatarUuid: 1 } })
		.toArray()
	for (let i = 0; i < cfs.length; ++i) {
		const cf = cfs[i]
		if (cf.avatarUuid) {
			const avatar = await storageController?.get(`avatars/${uid}/${cf.avatarUuid}`)
			if (avatar) {
				await processAvatar(cf._id.toString(), avatar)
			}
		}
	}

	const user = await getCollection("users").findOne({ uid, _id: uid }, { projection: { _id: 1, avatarUuid: 1 } })
	if (user.avatarUuid) {
		const avatar = await storageController?.get(`avatars/${uid}/${user.avatarUuid}`)
		if (avatar) {
			await processAvatar(user._id.toString(), avatar)
		}
	}
}

//-------------------------------//
// Create data export of all data of a user
//-------------------------------//
export const createDataExportForUser = async (uid: string) : Promise<{ [key: string]: any }> => 
{
	const allData: { [key: string]: any } = {}

	const collections = await db()!.listCollections().toArray()

	for (let i = 0; i < collections.length; ++i) {
		const collection = collections[i]
		const name: string = collection.name
		const split = name.split(".")
		const actualName = split[split.length - 1]

		// Don't send accounts info, this contains password and hash.
		if (actualName === "accounts") {
			continue;
		}

		const collectionData = await getCollection(actualName).find({ uid }).toArray()

		// Decrypt chat messages
		if (actualName === "chatMessages") {
			for (let i = 0; i < collectionData.length; ++i)
			{
				const message = collectionData[i];
				if (message.iv && message.message) {
					message.message = decryptMessage(message.message, message.iv)
				}
			}
		}
		
		allData[actualName] = collectionData
	}

	return allData;
}

const MINUTES_BETWEEN_EXPORT_ATTEMPTS = 5
const HOURS_BETWEEN_EXPORTS = 24

//-------------------------------//
// Export all data of a user
//-------------------------------//
export const exportData = async (uid: string): Promise<{ success: boolean; code: number; msg: string }> => {
	const privateUser = await getCollection("private").findOne({ uid, _id: uid })

	if (!privateUser) {
		return { success: false, code: 404, msg: "Can't find user" }
	}

	const lastExportAttempt: number = privateUser.lastExportAttempt ?? 0
	const minutesSinceLastExport = moment(moment.now()).diff(moment(lastExportAttempt), "minutes");
	if (minutesSinceLastExport < MINUTES_BETWEEN_EXPORT_ATTEMPTS) {
		return { success: false, code: 429, msg: `Please wait ${Math.ceil(MINUTES_BETWEEN_EXPORT_ATTEMPTS - minutesSinceLastExport)} minute(s) before requesting another export` }
	}

	const lastExport: number = privateUser.lastExport ?? 0
	const hoursSinceLastExport = moment(moment.now()).diff(moment(lastExport), "hours")
	if (hoursSinceLastExport < HOURS_BETWEEN_EXPORTS) {
		return { success: false, code: 403, msg: `You already exported your data in the last 24 hours, please try again in ${Math.ceil(HOURS_BETWEEN_EXPORTS - hoursSinceLastExport)} hour(s)` }
	}

	await getCollection("private").updateOne({ uid, _id: uid }, { $set: { lastExportAttempt: moment.now() } })

	const getFile = promisify(readFile)
	let emailTemplate = await getFile("./templates/exportEmailTemplate.html", "utf-8")

	const avatarKey = randomBytes(128).toString("hex")
	const dataKey = randomBytes(128).toString("hex")

	const baseUrl = config().server.baseUrl
	emailTemplate = emailTemplate.replace("{{export_avatar_url}}", `${baseUrl}/v1/user/export/avatars/?key=${avatarKey}&uid=${uid}`)
	emailTemplate = emailTemplate.replace("{{export_data_url}}", `${baseUrl}/v1/user/export/data/?key=${dataKey}&uid=${uid}`)

	const exp = moment.now() + 1000 * 60 * 60 * 24

	await getCollection("dataExports").insertOne({ uid, key: dataKey, exp, downloads: 0, lastDownload: 0 })
	await getCollection("avatarExports").insertOne({ uid, key: avatarKey, exp, downloads: 0, lastDownload: 0 })

	const emailResult = await sendCustomizedEmail(uid, emailTemplate, "Your requested data export", [])
	if (emailResult instanceof Error) {
		return { success: false, code: 500, msg: `Failed to send export email: ${emailResult.message}` }
	}

	return { success: true, code: 200, msg: "" }
}
