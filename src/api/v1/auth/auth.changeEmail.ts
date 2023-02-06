import { timingSafeEqual } from "crypto";
import { readFile } from "fs";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";
import { hash } from "./auth.hash";
import { base64decodeJwt } from "./auth.jwt";
import { getEmailRegex, revokeAllUserAccess } from "./auth.core";
import { userNotFound } from "../../../modules/messages";

//-------------------------------//
// Change password
//-------------------------------//
export const changeEmail_Execution = async (oldEmail: string, password: string, newEmail: string): Promise<{ success: boolean; msg: string; uid: string }> => {
	const user = await getCollection("accounts").findOne({ email: getEmailRegex(oldEmail) });

	if (user.oAuth2 === true) {
		return { success: false, msg: "You cannot change the email of an account when you use Sign in with Apple or Sign in with Google", uid: "" };
	}

	const existingUser = await getCollection("accounts").findOne({ email: getEmailRegex(newEmail) });
	if (existingUser) {
		return { success: false, msg: "A user with that email already exists", uid: "" };
	}

	if (user) {
		const hashedPasswd = await hash(password, user.salt);

		const knownHash = base64decodeJwt(user.password);
		const bGeneratedHash = base64decodeJwt(hashedPasswd.hashed);
		if (bGeneratedHash.length !== knownHash.length) {
			return { success: false, msg: "Unknown user or password", uid: "" };
		}

		if (timingSafeEqual(bGeneratedHash, knownHash)) {
			// Invalidate verified email
			await getCollection("accounts").updateOne({ uid: user.uid }, { $set: { email: newEmail, verified: false } });

			revokeAllUserAccess(user.uid);

			{
				const getFile = promisify(readFile);
				let emailTemplate = await getFile("./templates/emailChanged.html", "utf-8");

				// This template has the url twice
				emailTemplate = emailTemplate.replace("{{oldEmail}}", oldEmail);
				emailTemplate = emailTemplate.replace("{{newEmail}}", newEmail);

				await mailerTransport
					?.sendMail({
						from: '"Apparyllis" <noreply@apparyllis.com>',
						to: oldEmail,
						html: emailTemplate,
						subject: "Your Simply Plural email changed",
					})
					.catch((reason) => {
						reason.toString() as string;
					});
			}

			{
				const getFile = promisify(readFile);
				let emailTemplate = await getFile("./templates/emailChanged.html", "utf-8");

				// This template has the url twice
				emailTemplate = emailTemplate.replace("{{oldEmail}}", oldEmail);
				emailTemplate = emailTemplate.replace("{{newEmail}}", newEmail);

				await mailerTransport
					?.sendMail({
						from: '"Apparyllis" <noreply@apparyllis.com>',
						to: newEmail,
						html: emailTemplate,
						subject: "Your Simply Plural email changed",
					})
					.catch((reason) => {
						reason.toString() as string;
					});
			}

			return { success: true, msg: "", uid: user.uid };
		}

		return { success: false, msg: "Password invalid", uid: "" };
	} else {
		return { success: false, msg: userNotFound(), uid: "" };
	}
};
