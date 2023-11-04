import * as Sentry from "@sentry/node";
import { getCollection } from "../../../modules/mongo";
import { auth } from "firebase-admin";
import { ERR_AUTH_USER_NOT_FOUND } from "../../../modules/errors";
import { sendCustomizedEmail, sendCustomizedEmailToEmail } from "../../../modules/mail";
import { getTemplate, mailTemplate_accountReminder } from "../../../modules/mail/mailTemplates";

//-------------------------------//
// Request email
//-------------------------------//
export const requestEmail_Execution = async (username: string): Promise<{ success: boolean; msg: string }> => {
	const user = await getCollection("users").findOne({ username: { $regex: "^" + username + "$", $options: "i" } });
	if (user) {
		let userEmail = "";

		const account = await getCollection("accounts").findOne({ uid: user.uid });
		if (account) {
			userEmail = account.email;
		} else {
			const firebaseUser = await auth()
				.getUser(user.uid)
				.catch(() => undefined);
			if (!firebaseUser) {
				Sentry.captureMessage(`ErrorCode(${ERR_AUTH_USER_NOT_FOUND}): Unable to find a user natively or through firebase`);
				return { success: false, msg: "Internal error" };
			}

			if (!firebaseUser.email) {
				Sentry.captureMessage(`ErrorCode(${ERR_AUTH_USER_NOT_FOUND}): Able to find a user through firebase but they have no email set`);
				return { success: false, msg: "Internal error" };
			}

			userEmail = firebaseUser.email;
		}

		let emailTemplate = getTemplate(mailTemplate_accountReminder());

		emailTemplate = emailTemplate.replace("{{username}}", username);
		emailTemplate = emailTemplate.replace("{{email}}", userEmail);

		sendCustomizedEmail(user.uid, emailTemplate, "Your Simply Plural Account");

		return { success: true, msg: "If a user exists for that username, you will receive an email under the account it is registered under" };
	} else {
		return { success: true, msg: "If a user exists for that username, you will receive an email under the account it is registered under" };
	}
};
