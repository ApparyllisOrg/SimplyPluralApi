import { randomBytes } from "crypto";
import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";
import * as Sentry from "@sentry/node";
import { getAPIUrl } from "../../../util";

//-------------------------------//
// Generate a new random confirmation key
//-------------------------------//
export const getConfirmationKey = () => randomBytes(64).toString("hex");

//-------------------------------//
// Send the confirmation email for the supplied uid
//-------------------------------//
export const sendConfirmationEmail = async (uid: string): Promise<{ success: boolean; msg: string }> => {
	const user = await getCollection("accounts").findOne({ uid });
	if (!user) {
		return { success: false, msg: "User not found" };
	}

	if (user.verified === true) {
		return { success: false, msg: "User is already verified!" };
	}

	if (user.lastConfirmationEmailSent) {
		const lastTimestamp = user.lastConfirmationEmailSent;
		if (moment.now() - 1000 * 60 < lastTimestamp) {
			return { success: false, msg: "Confirmation links can only be requested once every minute" };
		}
	}

	await getCollection("accounts").updateOne({ uid }, { $set: { lastConfirmationEmailSent: moment.now() } });

	const getFile = promisify(readFile);
	let emailTemplate = await getFile("./templates/verifyEmail.html", "utf-8");

	// Email confirmation mail can be sent in different situations
	// 1) The user has registered through the new auth code, the confirmation code is set in the `register` function to `user.verificationCode`, and the usual URL should be okay.
	// 2) The user has registered before 1.8 through Firebase but never confirmed their account. The confirmation code was never set.
	// 3) The user has registered before 1.8 through Firebase, previously verified their account, but changed their email. `user.verified` has been set as false, and no new confirmation key was set.

	let verificationUrl;
	if (user.verificationCode === undefined) {
		const verificationCode = getConfirmationKey();
		await getCollection("accounts").updateOne({ uid }, { $set: { verificationCode: verificationCode } });
		verificationUrl = getAPIUrl(`v1/auth/verification/confirm?key=${verificationCode}&uid=${uid}`);
	} else {
		verificationUrl = getAPIUrl(`v1/auth/verification/confirm?key=${user.verificationCode}&uid=${uid}`);
	}

	// This template has the url twice
	emailTemplate = emailTemplate.replace("{{verificationUrl}}", verificationUrl);
	emailTemplate = emailTemplate.replace("{{verificationUrl}}", verificationUrl);

	const result: any = await mailerTransport
		?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: user.email,
			html: emailTemplate,
			subject: "Verify your Simply Plural account",
		})
		.catch((reason) => {
			console.log(reason.toString() as string);
		});

	if (result && result.err) {
		Sentry.captureMessage(result.err.toString());
		return { success: false, msg: "Failed to send confirmation email, does the email exist?" };
	}

	return { success: true, msg: "" };
};

//-------------------------------//
// Confirm the email of the supplied uid with key
//-------------------------------//
export const confirmUserEmail = async (uid: string, key: string): Promise<boolean> => {
	const user = await getCollection("accounts").findOne({ uid });
	if (!user) {
		return false;
	}

	if (user.verified === true) {
		return false;
	}

	if (user.verificationCode === key) {
		await getCollection("accounts").updateOne({ uid }, { $set: { verified: true }, $unset: { verificationCode: "" } });
		return true;
	}

	return false;
};
