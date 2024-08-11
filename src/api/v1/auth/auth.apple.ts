import { getCollection } from "../../../modules/mongo"
import * as Sentry from "@sentry/node"
import { auth } from "firebase-admin"
import { getEmailRegex, getNewUid } from "./auth.core"
import { decode, JwtPayload, verify } from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { migrateAccountFromFirebase } from "./auth.migrate"
import { setupNewUser } from "../user"

async function key(kid: any) {
	const client = jwksClient({
		jwksUri: "https://appleid.apple.com/auth/keys",
		timeout: 30000,
	})

	return await client.getSigningKey(kid)
}

export const loginWithApple = async (credential: string, version: number | null): Promise<{ success: boolean; uid: string; email: string }> => {
	const decoded = decode(credential, { complete: true })

	if (!decoded) {
		return { success: false, uid: "", email: "" }
	}

	const kid = decoded.header.kid
	const publicKey = (await key(kid)).getPublicKey()
	const payload: JwtPayload | string = verify(credential, publicKey)

	if (!payload) {
		return { success: false, uid: "", email: "" }
	}

	if (typeof payload === "string") {
		return { success: false, uid: "", email: "" }
	}

	if (payload.aud !== "com.apparyllis.simplyplural" && payload.aud !== "com.apparyllis.simplyplural.web") {
		return { success: false, uid: "", email: "" }
	}

	const email = payload["email"]
	const account = await getCollection("accounts").findOne({ email: getEmailRegex(payload.email ?? "") })

	if (!account) {
		const result = await registerSub(payload, version)

		if (result !== true) {
			return { success: false, uid: "", email: "" }
		}

		const registeredAccount = await getCollection("accounts").findOne({ email: getEmailRegex(payload.email ?? "") })

		if (!registeredAccount) {
			Sentry.captureMessage("Unable to register account of email " + email)
			return { success: false, uid: "", email: "" }
		}

		return { success: true, uid: registeredAccount.uid, email: registeredAccount.email }
	} else {
		return { success: true, uid: account.uid, email: account.email }
	}
}

const registerSub = async (payload: JwtPayload, version: number | null): Promise<boolean> => {
	const firebaseUser = await auth()
		.getUserByEmail(payload.email ?? "")
		.catch(() => undefined)
	if (!firebaseUser) {
		const newUserId = await getNewUid()
		await setupNewUser(newUserId, version)
		await getCollection("accounts").insertOne({ uid: newUserId, sub: payload.sub, email: payload.email, verified: true, oAuth2: true, registeredAt: new Date() })
		return true
	}

	migrateAccountFromFirebase(firebaseUser.uid)

	const account = await getCollection("accounts").findOne({ uid: firebaseUser.uid })
	if (account) {
		await getCollection("accounts").updateOne({ uid: firebaseUser.uid }, { $set: { sub: payload.sub } })
	} else {
		await getCollection("accounts").insertOne({
			uid: firebaseUser.uid,
			sub: payload.sub,
			email: firebaseUser.email,
			verified: true,
			oAuth2: true,
			registeredAt: firebaseUser.metadata.creationTime ?? new Date(),
		})
	}

	return true
}
