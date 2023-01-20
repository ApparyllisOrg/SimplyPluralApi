import { randomBytes } from "crypto";
import { auth } from "firebase-admin";
import * as jwt from "jsonwebtoken";
import { getCollection } from "../../../modules/mongo"
import { namedArguments } from "../../../util/args";

const jwtKey = process.env.JWT_KEY ?? (namedArguments.jwt_key ?? "")
if (jwtKey.length === 0) throw new Error("JWT_KEY needs to be defined!")

const thirtyDays = 60 * 60 * 24 * 30

const GOOGLE_CLIENT_JWT_AUD = process.env.GOOGLE_CLIENT_JWT_AUD ?? ""

//-------------------------------//
// base64 decode the encoded string
//-------------------------------//
export const base64decodeJwt = (encoded : string) => {
	return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

//-------------------------------//
// Generate a new JWT for user
//-------------------------------//
export const jwtForUser = async (uid: string, fallbackEmail: string | undefined, fallbackVerified: boolean | undefined) : Promise<{access: string, refresh: string}> => {
	const now = Date.now() / 1000
	const user = await getCollection("accounts").findOne({uid})

	const verified = user ? user.verified : fallbackVerified
	const email = user ? user.email : fallbackEmail

	if (verified === undefined)
	throw "Unable to fetch verified for jwt"

	if (email === undefined)
	throw "Unable to fetch email for jwt"

	const access = jwt.sign({sub: uid, iss: "Apparyllis", iat: now, exp: Math.floor(Date.now() / 1000) + 30 * 60, verified, email}, jwtKey);
	const refresh = jwt.sign({sub: uid, iss: "Apparyllis", iat: now, exp: Math.floor(Date.now() / 1000) + thirtyDays, refresh: true, verified, email}, jwtKey);
	return { access, refresh };
}

//-------------------------------//
//  Validate JWT Issue time
//-------------------------------//
const isJwtValidIssueTime = async (uid: string, time: number) : Promise<boolean> => 
{
	const user = await getCollection("accounts").findOne({uid})

	// No first valid jwt means means all jwts issues from apparyllis are valid, as long as they're not expired
	if (user && user.firstValidJWtTime && time <= user.firstValidJWtTime)
	{
		return false;
	}

	return true;
}

//-------------------------------//
//  Validate JWT
//-------------------------------//
export const isJwtValid = async (jwtStr: string, wantsRefresh: boolean) : Promise<{valid : boolean, decoded: any, google: boolean, email: string}> => {
	return new Promise<{valid : boolean, decoded: any, google: boolean, email: string}>((resolve, reject) => { 
		jwt.verify(jwtStr, jwtKey, async function(err, decoded) {
			let payload = decoded as jwt.JwtPayload
			if (err || !decoded) {
				const result = await auth().verifyIdToken(jwtStr, true).catch((e) => null)
				if (result && result.aud === GOOGLE_CLIENT_JWT_AUD)
				{
					// Authing with a firebase token is only allowed when our account has not yet merged
					const existingUser = await getCollection("accounts").findOne({uid: result.uid})
					if (existingUser)
					{
						resolve({valid: false, decoded: "", google: true, email: existingUser.email})
						return;
					}

					// Google JWTs are always refresh tokens
					resolve({valid: true, decoded: result.uid, google: true, email: result.email!})
					return
				}
				else 
				{
					resolve({valid: false, decoded: "", google: false, email: ""});
				}
			} else if (payload) {
				if (payload.iss !== "Apparyllis")
				{
					resolve({valid: false, decoded: "", google: false, email: ""});
					return;
				}

				if (wantsRefresh === true)
				{		
					const result = await isJwtValidIssueTime(payload.sub!, payload.iat!)
					if (!result)
					{
						resolve({valid: false, decoded: "", google: false, email: ""});
						return;
					}

					if (payload["refresh"] === true)
					{
						resolve({valid: true, decoded: decoded, google: false, email: payload.email ?? ""});
					} else {
						resolve({valid: false, decoded: "", google: false, email: ""});
					}
				} else  {
					if (!payload["refresh"])
					{
						resolve({valid: true, decoded: decoded, google: false, email: payload.email ?? ""});
					} else {
						resolve({valid: false, decoded: "", google: false, email: ""});
					}
				}
			}
		})
	});
}
