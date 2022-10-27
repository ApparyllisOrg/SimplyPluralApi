import { randomBytes } from "crypto"
import { auth } from "firebase-admin"
import { readFile } from "fs"
import moment from "moment"
import Mail from "nodemailer/lib/mailer"
import { promisify } from "util"
import { mailerTransport } from "../../../modules/mail"
import { db, getCollection } from "../../../modules/mongo"
import { getFileFromStorage } from "../../../modules/storage"

//-------------------------------//
// Fetch all avatars from a user
//-------------------------------//
export const fetchAllAvatars = async (uid: string) : Promise<{name: string, data: Buffer[]}[]> => {
	const avatars : {name: string, data: Buffer[]}[] = []

	const members = await getCollection("members").find({uid}).toArray()

	for (let i = 0; i < members.length; ++i)
	{
		const member = members[i]
		if (member.avatarUuid)
		{
			const avatar = await getFileFromStorage(`avatars/${uid}/${member.avatarUuid}`)
			if (avatar)
			{
				avatars.push({name: member._id.toString(), data: avatar})
			}
		}
	}

	const cfs = await getCollection("frontStatuses").find({uid}).toArray()
	for (let i = 0; i < cfs.length; ++i)
	{
		const cf = cfs[i]
		if (cf.avatarUuid)
		{
			const avatar = await getFileFromStorage(`avatars/${uid}/${cf.avatarUuid}`)
			if (avatar)
			{
				avatars.push({name: cf._id.toString(), data: avatar})
			}
		}
	}

	const user = await getCollection("users").findOne({uid, _id: uid})
	if (user.avatarUuid)
	{
		const avatar = await getFileFromStorage(`avatars/${uid}/${user.avatarUuid}`)
		if (avatar)
		{
			avatars.push({name: user._id.toString(), data: avatar})
		}
	}

	console.log(avatars.length)

	return avatars;
}

//-------------------------------//
// Export all data of a user
//-------------------------------//
export const exportData = async (uid: string) : Promise<{success: boolean, code: number, msg: string}> => {

const privateUser = await getCollection("private").findOne({uid})

	if (!privateUser)
	{
		return {success: false, code: 404, msg: "Can't find user"}
	}

	const lastExport : number = privateUser.lastExport ?? 0;
	if (moment(moment.now()).diff(moment(lastExport), "hours") < 24)
	{
		return {success: false, code: 403, msg: 'You already exported your data in the last 24 hours'}
	}

	const collections = await db()!.listCollections().toArray();

	let allData: { [key: string]: any } = {};

	for (let i = 0; i < collections.length; ++i)
	{	
		const collection = collections[i];
		const name: string = collection.name;
		const split = name.split(".");
		const actualName = split[split.length - 1];

		const collectionData = await getCollection(actualName).find({uid}).toArray();
		allData[actualName] = collectionData;
	}

	const user = await auth().getUser(uid)

	const email = user.email ?? "";

	const getFile = promisify(readFile);
	let emailTemplate = await getFile("./templates/exportEmailTemplate.html", "utf-8");

	let randomKey = randomBytes(128).toString("hex")

	if (process.env.PRETESTING === "true")
	{
		emailTemplate = emailTemplate.replace("{{export_avatar_url}}", `https://devapi.apparyllis.com/v1/user/export/avatars/?key=${randomKey}&uid=${uid}`)
	}
	else 
	{
		emailTemplate = emailTemplate.replace("{{export_avatar_url}}", `https://api.apparyllis.com/v1/user/export/avatars/?key=${randomKey}&uid=${uid}`)
	}
	
	const attachement : Mail.Attachment ={
			filename: "export.json",
			content: JSON.stringify(allData)
		};

	const resolution = await mailerTransport?.sendMail({
		from: '"Apparyllis" <noreply@apparyllis.com>',
		to: email,
		subject: "Your requested data export",
		html: emailTemplate,
		attachments: [attachement]
	}).catch((e) => {
		console.log(e)
		return "ERR";
	})

	if (resolution === "ERR")
	{
		return {success: true, code: 400, msg: 'Unable to deliver the data to your email. Does the email exist?'}
	}

	getCollection("avatarExports").insertOne({uid, key: randomKey, exp: moment.now() + (1000 * 60 * 60 * 24 * 7)})


	return {success: true, code: 200, msg: ''}
}
