import { randomBytes } from "crypto";
import { readFile } from "fs";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";

export const getConfirmationKey = () => randomBytes(64).toString("hex")

export const sendConfirmationEmail = async (uid : string) : Promise<boolean> => {
	const user = await getCollection("accounts").findOne({uid: uid})
	if (!user)
	{
		return false;
	}

	const getFile = promisify(readFile);
	let emailTemplate = await getFile("./templates/verifyEmail.html", "utf-8");

	const verificationUrl = `https://api.apparyllis.com/v1/auth/verification/confirm?key=${user.verificationCode}&uid=${uid}`

	// This template has the url twice
	emailTemplate = emailTemplate.replace("{{verificationUrl}}", verificationUrl)
	emailTemplate = emailTemplate.replace("{{verificationUrl}}", verificationUrl)

	const result : any = await mailerTransport?.sendMail({
		from: '"Apparyllis" <noreply@apparyllis.com>',
		to: user.email,
		html: emailTemplate,
		subject: "Verify your Simply Plural account",
	}).catch((reason) => {err: reason.toString() as string})

	if (result && result.err)
	{
		return false;
	}

	return true;
}

export const confirmEmail = async (uid: string, key: string) : Promise<boolean> => {
	return true;
}