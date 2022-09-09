import { randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";
import { getCollection } from "../../../modules/mongo"

const jwtKey = process.env.JWT_KEY ?? ""
if (jwtKey.length === 0) throw new Error("JWT_KEY needs to be defined!")

const thirtyDays = 60 * 60 * 24 * 30

//-------------------------------//
// base64 decode the encoded string
//-------------------------------//
export const base64decodeJwt = (encoded : string) => {
	return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

//-------------------------------//
// Generate a new JWT for user
//-------------------------------//
export const jwtForUser = (uid: string) : {access: string, refresh: string} => {
	const now = Date.now() / 1000
	const access = jwt.sign({uid, iss: "Apparyllis", iat: now, exp: Math.floor(Date.now() / 1000) + 30 * 60}, jwtKey);
	const refresh = jwt.sign({uid, iss: "Apparyllis", iat: now, exp: Math.floor(Date.now() / 1000) + thirtyDays, refresh: true}, jwtKey);
	return { access, refresh };
}

//-------------------------------//
//  Validate JWT
//-------------------------------//
export const isJwtValid = async (jwtStr: string, wantsRefresh: boolean) : Promise<{valid : boolean, decoded: any}> => {
	return new Promise<{valid : boolean, decoded: any}>((resolve, reject) => { 
		jwt.verify(jwtStr, jwtKey, function(err, decoded) {
			let payload = decoded as jwt.JwtPayload
			if (err || !decoded) {
				resolve({valid: false, decoded: ""});
			} else if (payload) {
				if (wantsRefresh === true)
				{		
					if (payload["refresh"] === true)
					{
						resolve({valid: true, decoded: decoded});
					} else {
						resolve({valid: false, decoded: ""});
					}
					
				} else  {
					if (!payload["refresh"])
					{
						resolve({valid: true, decoded: decoded});
					} else {
						resolve({valid: false, decoded: ""});
					}
				}
			}
		})
	});
}
