import { randomBytes, timingSafeEqual } from "crypto";
import { readFile } from "fs";
import * as Sentry from "@sentry/node";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";
import { hash } from "./auth.hash";
import { base64decodeJwt } from "./auth.jwt";
import moment from "moment";
import { revokeAllUserAccess } from "./auth.core";
import { getAuth } from "firebase/auth";
import { auth } from "firebase-admin";
import { ERR_AUTH_USER_NOT_FOUND } from "../../../modules/errors";

//-------------------------------//
// Request email
//-------------------------------//
export const requestEmail_Execution = async (username: string) : Promise<{success: boolean, msg: string}> => {
	const user = await getCollection("users").findOne({username})
	if (user)
	{
		let userEmail = "";

		const account = await getCollection("accounts").findOne({uid:user.uid})
		if (account)
		{
			userEmail = account.email;
		}
		else 
		{
			const firebaseUser = await auth().getUser(user.uid).catch((e) => undefined)
			if (!firebaseUser)
			{
				Sentry.captureMessage(`ErrorCode(${ERR_AUTH_USER_NOT_FOUND}): Unable to find a user natively or through firebase`);
				return { success: false, msg: "Internal error" }
			}

			if (!firebaseUser.email)
			{
				Sentry.captureMessage(`ErrorCode(${ERR_AUTH_USER_NOT_FOUND}): Able to find a user through firebase but they have no email set`);
				return { success: false, msg: "Internal error" }
			}

			userEmail = firebaseUser.email;
		}
		
		const getFile = promisify(readFile);
		let emailTemplate = await getFile("./templates/accountReminder.html", "utf-8");

		emailTemplate = emailTemplate.replace("{{username}}", username)

		await mailerTransport?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: userEmail,
			html: emailTemplate,
			subject: "Your Simply Plural Account",
		}).catch((reason) => {err: reason.toString() as string})
			
		return { success:true, msg: "If a user exists for that username, you will receive an email under the account it is registered under" }
	}
	else 
	{
		return { success:true, msg: "If a user exists for that username, you will receive an email under the account it is registered under" }
	}
}