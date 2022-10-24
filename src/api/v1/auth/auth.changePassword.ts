import { randomBytes } from "crypto";
import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import { mailerTransport } from "../../../modules/mail";
import { getCollection } from "../../../modules/mongo";
import { hash } from "./auth.hash";
import { base64decodeJwt } from "./auth.jwt";

//-------------------------------//
// Change password
//-------------------------------//
export const changePassword_Execution = async (uid: string, oldPassword : string, newPassword: string, activeRefreshToken: string) : Promise<{success: boolean, msg: string, uid: string}> => {
	const user = await getCollection("accounts").findOne({uid})
	if (user)
	{
		if (user.oAuth2 === true)
		{
			return {success:false, msg:"oAuth2 users cannot change their password, they don't have any", uid: user.uid}
		}

		const hashedPasswd = await hash(oldPassword, user.salt)

		const knownHash = base64decodeJwt(user.password)
		const bGeneratedHash = base64decodeJwt(hashedPasswd.hashed)
		if (bGeneratedHash.length !== knownHash.length) {
			return {success: false, msg:"Unknown user or password", uid: ""}
		}

		// Revoke all refresh tokens except the one that requested this
		const refreshTokens: string[] = user.refreshTokens
		refreshTokens.forEach((token : any) =>
		{
			if (token !== activeRefreshToken)
			{
				getCollection("invalidJwtTokens").insertOne({jwt: token})
			}
		});

		const newHashedPasswd = await hash(newPassword, user.salt)

		await getCollection("accounts").updateOne({uid}, {$set: {password: newHashedPasswd}})
		{
				const getFile = promisify(readFile);
				let emailTemplate = await getFile("./templates/passwordChangedEmail.html", "utf-8");

				// This template has the url twice
				if (process.env.PRETESTING === "true")
				{
					emailTemplate = emailTemplate.replace("{{resetUrl}}", `https://devapi.apparyllis.com/v1/auth/password/reset?email=${user.email}`)
				}
				else 
				{
					emailTemplate = emailTemplate.replace("{{resetUrl}}", `https://api.apparyllis.com/v1/auth/password/reset?email=${user.email}`)
				}

				mailerTransport?.sendMail({
					from: '"Apparyllis" <noreply@apparyllis.com>',
					to: user.email,
					html: emailTemplate,
					subject: "Your Simply Plural password changed",
				}).catch((reason) => {err: reason.toString() as string})
			}

		return {success:true, msg:"", uid: user.uid}

	}
	else 
	{
		return {success:false, msg:"User not found", uid: ""}
	}
}