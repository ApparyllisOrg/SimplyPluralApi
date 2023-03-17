import { timingSafeEqual } from "crypto";
import { readFile } from "fs";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { userNotFound } from "../../../modules/messages";
import { getCollection } from "../../../modules/mongo";
import { getAPIUrl } from "../../../util";
import { getPasswordRegex, passwordRegexError, revokeAllUserAccess } from "./auth.core";
import { hash } from "./auth.hash";
import { base64decodeJwt } from "./auth.jwt";

//-------------------------------//
// Change password
//-------------------------------//
export const changePassword_Execution = async (uid: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; msg: string; uid: string }> => {
	const user = await getCollection("accounts").findOne({ uid, oAuth2: { $ne: true } });
	if (user) {
		if (user.oAuth2 === true) {
			return { success: false, msg: "oAuth2 users cannot change their password, they don't have any", uid: user.uid };
		}

		const hashedPasswd = await hash(oldPassword, user.salt);

		const knownHash = base64decodeJwt(user.password);
		const bGeneratedHash = base64decodeJwt(hashedPasswd.hashed);

		if (bGeneratedHash.length !== knownHash.length) {
			return { success: false, msg: "Unknown user or password", uid: "" };
		}

		if (!timingSafeEqual(bGeneratedHash, knownHash)) {
			return { success: false, msg: "Unknown user or password", uid: "" };
		}

		revokeAllUserAccess(user.uid);

		if (!getPasswordRegex().test(newPassword)) return { success: false, msg: passwordRegexError, uid: "" };

		const newHashedPasswd = await hash(newPassword, user.salt);

		await getCollection("accounts").updateOne({ uid }, { $set: { password: newHashedPasswd.hashed } });
		{
			const getFile = promisify(readFile);
			let emailTemplate = await getFile("./templates/passwordChangedEmail.html", "utf-8");

			emailTemplate = emailTemplate.replace("{{resetUrl}}", getAPIUrl(`v1/auth/password/reset?email=${user.email}`));

			mailerTransport
				?.sendMail({
					from: '"Apparyllis" <noreply@apparyllis.com>',
					to: user.email,
					html: emailTemplate,
					subject: "Your Simply Plural password changed",
				})
				.catch((reason) => {
					reason.toString() as string;
				});
		}

		return { success: true, msg: "", uid: user.uid };
	} else {
		return { success: false, msg: userNotFound(), uid: "" };
	}
};
