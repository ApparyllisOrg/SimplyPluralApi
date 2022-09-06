import { randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";
import { getCollection } from "../../../modules/mongo"

const jwtKey = process.env.JWT_KEY ?? ""
if (jwtKey.length === 0) throw new Error("JWT_KEY needs to be defined!")

//-------------------------------//
// base64 decode the encoded string
//-------------------------------//
export const base64decodeJwt = (encoded : string) => {
	return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//
export const getNewUid = async () => {
	let randomUid = randomBytes(32).toString("hex")
	const existingUser =  await getCollection("accounts").findOne({uid: randomUid})
	// If it already exists (unlikely) try again until we find one that isn't taken yet
	if (existingUser)
	{
		randomUid = await getNewUid()
	}

	return randomUid;
}

//-------------------------------//
// Generate a new JWT for user
//-------------------------------//
export const jwtForUser = (uid: string) => {
	return jwt.sign({uid, exp: Math.floor(Date.now() / 1000) + 30 * 60}, jwtKey)
}

//-------------------------------//
//  Validate JWT
//-------------------------------//
export const isJwtValid = async (jwtStr: string) : Promise<{valid : boolean, decoded: any}> => {
	return new Promise<{valid : boolean, decoded: any}>((resolve, reject) => { 
		jwt.verify(jwtStr, jwtKey, function(err, decoded) {
			if (err) {
				resolve({valid: false, decoded: ""});
			} else {
				resolve({valid: true, decoded: decoded});
			}
		})
	});
}
