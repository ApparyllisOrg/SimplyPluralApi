import { OAuth2Client, TokenPayload } from "google-auth-library"
import { getCollection } from "../../../modules/mongo"
import * as Sentry from "@sentry/node"
import { auth } from "firebase-admin"
import { getEmailRegex, getNewUid } from "./auth.core"

import { migrateAccountFromFirebase } from "./auth.migrate"
import { setupNewUser } from "../user"
import { config } from "../../../modules/config"

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//'

let android_client: OAuth2Client | undefined = undefined
let iOS_client: OAuth2Client | undefined = undefined
let _googleInitialized = false

const initGoogleClients = () => {
	if (_googleInitialized) return
	_googleInitialized = true

	const googleConfig = config().googleOAuth
	if (!googleConfig) {
		console.log("Running without google")
		return
	}

	android_client = new OAuth2Client(googleConfig.clientId, googleConfig.clientSecret)
	iOS_client = new OAuth2Client(googleConfig.clientIosId, googleConfig.clientSecret)
}

export const loginWithGoogle = async (credential: string, version: number | null): Promise<{ success: boolean; uid: string; email: string }> => {
	initGoogleClients()

	if (!android_client || !iOS_client) {
		return { success: false, uid: "", email: "" }
	}

	const googleConfig = config().googleOAuth!

	let ticket = await android_client
		.verifyIdToken({
			idToken: credential,
			audience: googleConfig.clientAud,
		})
		.catch((reason) => {
			if (config().development) {
				console.log(`Failed to verify id token => ${reason}`)
			}

			return undefined
		})

	if (!ticket) {
		ticket = await iOS_client
			.verifyIdToken({
				idToken: credential,
				audience: googleConfig.clientIosId,
			})
			.catch((reason) => {
				if (config().development) {
					console.log(`Failed to verify id token => ${reason}`)
				}

				return undefined
			})

		if (!ticket) {
			return { success: false, uid: "", email: "" }
		}
	}

	const payload = ticket.getPayload()

	if (!payload) {
		return { success: false, uid: "", email: "" }
	}

	if (payload.aud !== googleConfig.clientAud && payload.aud !== googleConfig.clientIosId) {
		return { success: false, uid: "", email: "" }
	}

	const account = await getCollection("accounts").findOne({ email: getEmailRegex(payload.email ?? "") })

	if (!account) {
		const result = await registerSub(payload, version)

		if (result !== true) {
			return { success: false, uid: "", email: "" }
		}

		const registeredAccount = await getCollection("accounts").findOne({ email: getEmailRegex(payload.email ?? "") })

		if (!registeredAccount) {
			Sentry.captureMessage("Unable to register account of email " + payload.email)
			return { success: false, uid: "", email: "" }
		}

		return { success: true, uid: registeredAccount.uid, email: registeredAccount.email }
	} else {
		return { success: true, uid: account.uid, email: account.email }
	}

	return { success: false, uid: "", email: "" }
}

const registerSub = async (payload: TokenPayload, version: number | null): Promise<boolean> => {
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
