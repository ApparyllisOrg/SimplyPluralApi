import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../../../modules/config";
const algorithm = "aes-256-ctr";

export const encryptMessage = (message: string): { iv: string; msg: string } => {
	const iv = randomBytes(16);
	const cipher = createCipheriv(algorithm, config().auth.messagesKey, iv);
	const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
	return {
		iv: iv.toString("base64"),
		msg: encrypted.toString("base64"),
	};
};

export const decryptMessage = (message: string, iv: string): string => {
	const decipher = createDecipheriv(algorithm, config().auth.messagesKey, Buffer.from(iv, "base64"));
	const decrpyted = Buffer.concat([decipher.update(Buffer.from(message, "base64")), decipher.final()]);
	return decrpyted.toString();
};
