import { randomBytes } from "crypto";
import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";
import * as Sentry from "@sentry/node";

//-------------------------------//
// Generate a new random confirmation key
//-------------------------------//
export const getConfirmationKey = () => randomBytes(64).toString("hex")

//-------------------------------//
// Send the confirmation email for the supplied uid
//-------------------------------//
export const sendConfirmationEmail = async (uid : string) : Promise<{success: boolean, msg: string}> => {
	const user = await getCollection("accounts").findOne({uid})
	if (!user)
	{
		return {success: false, msg: "User not found"};
	}

	if (user.lastConfirmationEmailSent)
	{
		const lastTimestamp = user.lastConfirmationEmailSent
		if (moment.now() - (1000 * 60) < lastTimestamp)
		{
			return {success: false, msg: "Confirmation links can only be requested once every minute"};
		}
	}

	await getCollection("accounts").updateOne({uid}, { $set: { lastConfirmationEmailSent: moment.now() }})

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
		Sentry.captureMessage(result.err.toString())
		return {success: false, msg: "Failed to send confirmation email, does the email exist?"};
	}

	return {success: true, msg: ""};
}

//-------------------------------//
// Confirm the email of the supplied uid with key
//-------------------------------//
export const confirmEmail = async (uid: string, key: string) : Promise<boolean> => {
	return true;
}