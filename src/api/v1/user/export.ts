import { randomBytes } from "crypto";
import { auth } from "firebase-admin";
import { readFile } from "fs";
import moment from "moment";
import Mail from "nodemailer/lib/mailer";
import { promisify } from "util";
import { sendCustomizedEmail } from "../../../modules/mail";
import { db, getCollection } from "../../../modules/mongo";
import { getFileFromStorage } from "../../../modules/storage";
import { getEmailForUser } from "../auth/auth.core";

//-------------------------------//
// Fetch all avatars from a user
//-------------------------------//
export const fetchAllAvatars = async (uid: string, processAvatar: (name: String, data: Buffer) => Promise<void>) : Promise<void> => {
	const members = await getCollection("members").find({ uid }, { projection: { _id: 1, avatarUuid: 1 } }).toArray();

	for (let i = 0; i < members.length; ++i) {
		const member = members[i];
		if (member.avatarUuid) {
			const avatar = await getFileFromStorage(`avatars/${uid}/${member.avatarUuid}`);
			if (avatar) {
				await processAvatar(member._id.toString(), avatar);
			}
		}
	}

	const cfs = await getCollection("frontStatuses").find({ uid }, { projection: { _id: 1, avatarUuid: 1 } }).toArray();
	for (let i = 0; i < cfs.length; ++i) {
		const cf = cfs[i];
		if (cf.avatarUuid) {
			const avatar = await getFileFromStorage(`avatars/${uid}/${cf.avatarUuid}`);
			if (avatar) {
				await processAvatar(cf._id.toString(), avatar);
			}
		}
	}

	const user = await getCollection("users").findOne({ uid, _id: uid }, { projection: { _id: 1, avatarUuid: 1 }});
	if (user.avatarUuid) {
		const avatar = await getFileFromStorage(`avatars/${uid}/${user.avatarUuid}`);
		if (avatar) {
			await processAvatar(user._id.toString(), avatar);
		}
	}
};

//-------------------------------//
// Export all data of a user
//-------------------------------//
export const exportData = async (uid: string): Promise<{ success: boolean; code: number; msg: string }> => {
	const privateUser = await getCollection("private").findOne({ uid, _id: uid });

	if (!privateUser) {
		return { success: false, code: 404, msg: "Can't find user" };
	}

	const lastExport: number = privateUser.lastExport ?? 0;
	if (moment(moment.now()).diff(moment(lastExport), "hours") < 24) {
		return { success: false, code: 403, msg: "You already exported your data in the last 24 hours" };
	}

	const collections = await db()!.listCollections().toArray();

	const allData: { [key: string]: any } = {};

	for (let i = 0; i < collections.length; ++i) {
		const collection = collections[i];
		const name: string = collection.name;
		const split = name.split(".");
		const actualName = split[split.length - 1];

		// Don't send accounts info, this contains password and hash.
		if (actualName !== "accounts") {
			const collectionData = await getCollection(actualName).find({ uid }).toArray();
			allData[actualName] = collectionData;
		}
	}
	
	const getFile = promisify(readFile);
	let emailTemplate = await getFile("./templates/exportEmailTemplate.html", "utf-8");

	const randomKey = randomBytes(128).toString("hex");

	if (process.env.PRETESTING === "true") {
		emailTemplate = emailTemplate.replace("{{export_avatar_url}}", `https://devapi.apparyllis.com/v1/user/export/avatars/?key=${randomKey}&uid=${uid}`);
	} else {
		emailTemplate = emailTemplate.replace("{{export_avatar_url}}", `https://api.apparyllis.com/v1/user/export/avatars/?key=${randomKey}&uid=${uid}`);
	}

	const attachement: Mail.Attachment = {
		filename: "export.json",
		content: JSON.stringify(allData),
	};

	sendCustomizedEmail(uid, emailTemplate, "Your requested data export", [], [attachement])

	getCollection("avatarExports").insertOne({ uid, key: randomKey, exp: moment.now() + 1000 * 60 * 60 * 24 * 7 });

	return { success: true, code: 200, msg: "" };
};
