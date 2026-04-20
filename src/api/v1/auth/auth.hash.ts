import { createCipheriv, scrypt } from "crypto";
import { base64decodeJwt } from "./auth.jwt";
import * as Sentry from "@sentry/node";
import { config } from "../../../modules/config";

//-------------------------------//
// Static password hash paremeters
//-------------------------------//
const getPasswordHash = () => ({
	hash: {
		algorithm: "SCRYPT" as const,
		key: config().auth.passwordKey,
		saltSeparator: config().auth.passwordSeparator,
		rounds: 8,
		memoryCost: 14,
	},
});

//-------------------------------//
// Hash a password with supplied salt
//-------------------------------//
export const hash = async (passwd: string, salt: string) => {
	return new Promise<{ salt: string; hashed: string }>((resolve, reject) => {
		const ALGORITHM = "aes-256-ctr";
		const IV_LENGTH = 16;
		const KEYLEN = 256 / 8;

		const passwordHash = getPasswordHash();
		const bSalt = Buffer.concat([base64decodeJwt(salt), base64decodeJwt(passwordHash.hash.saltSeparator)]);
		const iv = Buffer.alloc(IV_LENGTH, 0);

		scrypt(
			passwd,
			bSalt,
			KEYLEN,
			{
				N: 2 ** passwordHash.hash.memoryCost,
				r: passwordHash.hash.rounds,
				p: 1,
			},
			async (err: Error | null, derivedKey) => {
				if (err) {
					Sentry.captureMessage(err.message);
					reject();
					return;
				}

				try {
					const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
					resolve({ salt: salt, hashed: Buffer.concat([cipher.update(base64decodeJwt(passwordHash.hash.key)), cipher.final()]).toString("base64") });
				} catch (error) {
					Sentry.captureException(error);
					reject("");
				}
			}
		);
	});
};
