import { OAuth2Client, TokenPayload } from "google-auth-library"
import { getCollection } from "../../../modules/mongo";
import * as Sentry from "@sentry/node";
import { auth } from "firebase-admin";
import { getNewUid } from "./auth.core";
import { namedArguments } from "../../../util/args";
import moment from "moment";

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_AUD = process.env.GOOGLE_CLIENT_AUD ?? ""

const GOOGLE_CLIENT_IOS_ID = process.env.GOOGLE_CLIENT_IOS_ID ?? ""

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ""

let android_client : OAuth2Client | undefined = undefined;
let iOS_client : OAuth2Client | undefined = undefined;

if (namedArguments.without_google !== true) {
	if (GOOGLE_CLIENT_ID.length === 0) throw new Error("GOOGLE_CLIENT_ID needs to be defined!")
	if (GOOGLE_CLIENT_AUD.length === 0) throw new Error("GOOGLE_CLIENT_AUD needs to be defined!")

	if (GOOGLE_CLIENT_IOS_ID.length === 0) throw new Error("GOOGLE_CLIENT_IOS_ID needs to be defined!")

	if (GOOGLE_CLIENT_SECRET.length === 0) throw new Error("GOOGLE_CLIENT_SECRET needs to be defined!")

	android_client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
	iOS_client = new OAuth2Client(GOOGLE_CLIENT_IOS_ID, GOOGLE_CLIENT_SECRET);
} else {
	console.log("Running without google")
} 

export const loginWithGoogle = async (credential : string) : Promise<{ success: boolean, uid: string, email: string }> => {
	if (!android_client || !iOS_client)
	{
		return {success: false, uid: "", email: ""};
	}

	let ticket = await android_client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_AUD,
  	}).catch((reason) => 
	{
		if (process.env.DEVELOPMENT )
		{
			console.log(`Failed to verify id token => ${reason}`)
		}

		return undefined;
	});

	if (!ticket)
	{
		ticket = await iOS_client.verifyIdToken({
			idToken: credential,
			audience: process.env.GOOGLE_CLIENT_IOS_ID,
		}).catch((reason) => 
		{
			if (process.env.DEVELOPMENT )
			{
				console.log(`Failed to verify id token => ${reason}`)
			}

			return undefined;
		});

		if (!ticket)
		{
			return {success: false, uid: "", email: ""}
		}
	}

  	const payload = ticket.getPayload();

  	if (!payload)
	{
		return {success: false, uid: "", email: ""}
	}

	if (payload.aud !== GOOGLE_CLIENT_AUD && payload.aud !== GOOGLE_CLIENT_IOS_ID)
	{
		return {success: false, uid: "", email: ""}
	}

	const account = await getCollection("accounts").findOne({email: payload.email})

	if (!account)
	{
		const result = await registerSub(payload)

		if (result !== true)
		{
			return {success: false, uid: "", email: ""}
		}

		const registeredAccount = await getCollection("accounts").findOne({email: payload.email})

		if (!registeredAccount)
		{
			Sentry.captureMessage("Unable to register account of email " + payload.email)
			return {success: false, uid: "",  email:  ""}
		}

		return {success: true, uid: registeredAccount.uid,  email: registeredAccount.email}
	} 
	else
	{
		return {success: true, uid: account.uid, email: account.email}
	}

	return {success: false, uid: "", email: "" }
}

const registerSub = async (payload: TokenPayload) : Promise<boolean> => 
{
	const firebaseUser = await auth().getUserByEmail(payload.email ?? "").catch((e) => undefined)
	if (!firebaseUser)
	{
		const newUserId = await getNewUid();
		await getCollection("accounts").insertOne({uid: newUserId, sub: payload.sub, email: payload.email, verified: true, oAuth2: true, registeredAt: new Date()})
		return true;
	}

	const account = await getCollection("accounts").findOne({uid: firebaseUser.uid})
	if (account)
	{
		await getCollection("accounts").updateOne({uid: firebaseUser.uid}, {$set: {sub: payload.sub}})
	}
	else
	{
		await getCollection("accounts").insertOne({uid: firebaseUser.uid, sub: payload.sub, email: firebaseUser.email, verified: true , oAuth2: true, registeredAt: firebaseUser.metadata.creationTime ?? new Date()})
		getCollection("migration").insertOne({email: firebaseUser.email})
	}

	return true;
}