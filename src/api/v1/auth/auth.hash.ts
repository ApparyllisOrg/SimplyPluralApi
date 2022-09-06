import { createCipheriv, scrypt } from "crypto";
import { base64decodeJwt } from "./auth.jwt";
import * as Sentry from "@sentry/node";

//-------------------------------//
// Static password hash paremeters
//-------------------------------//
const passwordHash = {
 hash: {
   algorithm: 'SCRYPT',
   key: 'placeholder-base64key-eGpvaXpYZHQ1LD0sKG94Pykwe3FjTS0=',
   saltSeparator: 'placeholder-base64seperator-eGpvaXpYZHQ1LD0sKG94Pykwe3FjTS0=',
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