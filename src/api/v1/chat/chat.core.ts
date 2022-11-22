import { createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { namedArguments } from "../../../util/args"

const algorithm = 'aes-256-ctr'
const secretKey = process.env.MESSAGES_KEY ?? (namedArguments.messages_key ?? undefined)

if (!secretKey) throw new Error("You require to specify a MESSAGES_KEY!");

export const encryptMessage = (message: string) : { iv: string, msg: string } =>
{
	const iv = randomBytes(16)
	const cipher = createCipheriv(algorithm, secretKey, iv)
 	const encrypted = Buffer.concat([cipher.update(message), cipher.final()])
	return {
		iv: iv.toString("base64"),
		msg: encrypted.toString("base64")
	}
}

export const decryptMessage = (message: string, iv: string) : string =>
{
	const decipher = createDecipheriv(algorithm, secretKey, Buffer.from(iv, 'base64'))
	const decrpyted = Buffer.concat([decipher.update(Buffer.from(message, 'base64')), decipher.final()])
  	return decrpyted.toString()
}