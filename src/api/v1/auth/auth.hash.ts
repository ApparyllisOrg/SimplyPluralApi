import { createCipheriv, scrypt } from "crypto";
import { base64decodeJwt } from "./auth.jwt";
import * as Sentry from "@sentry/node";

const PASSWORD_KEY = process.env.PASSWORD_KEY ?? ""
const PASSWORD_SEPERATOR = process.env.PASSWORD_SEPERATOR ?? ""

if (PASSWORD_KEY.length === 0) throw new Error("PASSWORD_KEY needs to be defined!")
if (PASSWORD_SEPERATOR.length === 0) throw new Error("PASSWORD_SEPERATOR needs to be defined!")

//-------------------------------//
// Static password hash paremeters
//-------------------------------//
const passwordHash = {
 hash: {
   algorithm: 'SCRYPT',
   key: PASSWORD_KEY,
   saltSeparator:PASSWORD_SEPERATOR, 
   rounds: 8,
   memoryCost: 14
 }
};

//-------------------------------//
// Hash a password with supplied salt
//-------------------------------//
export const hash = async (passwd: string, salt: string) => {
	return new Promise<{salt: string, hashed: string}>((resolve, reject) => {
		const ALGORITHM = 'aes-256-ctr'
		const IV_LENGTH = 16
		const KEYLEN = 256 / 8

		const bSalt = Buffer.concat([
			base64decodeJwt(salt),
			base64decodeJwt(passwordHash.hash.saltSeparator),
		])
		const iv = Buffer.alloc(IV_LENGTH, 0)

		scrypt(passwd, bSalt, KEYLEN, {
			N: 2 ** passwordHash.hash.memoryCost,
			r: passwordHash.hash.rounds,
			p: 1,
		}, async (err : Error | null, derivedKey) => {
			if (err) {
				Sentry.captureMessage(err.message)
				reject()
				return;
			}

			try {
				const cipher = createCipheriv(ALGORITHM, derivedKey, iv)
				resolve({salt: salt, hashed: Buffer.concat([ cipher.update(base64decodeJwt(passwordHash.hash.key)), cipher.final() ]).toString('base64')})
			} catch (error) {
				Sentry.captureException(error)
				reject("")
			}
		})
	})
}