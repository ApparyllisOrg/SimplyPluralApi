import { OAuth2Client, TokenPayload } from "google-auth-library"
import { getCollection } from "../../../modules/mongo";
import * as Sentry from "@sentry/node";
import { auth } from "firebase-admin";
import { getNewUid } from "./auth.core";
import { namedArguments } from "../../../util/args";

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_AUD = process.env.GOOGLE_CLIENT_AUD ?? ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ""

let client : OAuth2Client | undefined = undefined;

if (namedArguments.without_google !== true) {
	if (GOOGLE_CLIENT_ID.length === 0) throw new Error("GOOGLE_CLIENT_ID needs to be defined!")
	if (GOOGLE_CLIENT_AUD.length === 0) throw new Error("GOOGLE_CLIENT_AUD needs to be defined!")
	if (GOOGLE_CLIENT_SECRET.length === 0) throw new Error("GOOGLE_CLIENT_SECRET needs to be defined!")

	client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
} else {
	console.log("Running without google")
} 

export const loginWithGoogle = async (credential : string, registerOnly : boolean) : Promise<{ success: boolean, uid: string }> => {
	if (!client)
	{
		return {success: false, uid: ""};
	}

	const ticket = await client.verifyIdToken({
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
		return {success: false, uid: ""}
	}

  	const payload = ticket.getPayload();

  	if (!payload)
	{
		return {success: false, uid: ""}
	}

	if (payload.aud !== GOOGLE_CLIENT_AUD)
	{
		return {success: false, uid: ""}
	}

	const googleUserId = payload['sub'];
	const account = await getCollection("accounts").findOne({sub: googleUserId})

	if (!account)
	{
		const result = await registerSub(payload)

		if (result !== true)
		{
			return {success: false, uid: ""}
		}

		const registeredAccount = await getCollection("accounts").findOne({sub: googleUserId})

		if (!registeredAccount)
		{
			Sentry.captureMessage("Unable to register account of sub " + googleUserId)
			return {success: false, uid: ""}
		}

		return {success: true, uid: registeredAccount.uid}
	} 
	else if (!registerOnly)
	{
		return {success: true, uid: account.uid}
	}

	return {success: false, uid: "" }
}

const registerSub = async (payload: TokenPayload) : Promise<boolean> => 
{
	const firebaseUser = await auth().getUserByEmail(payload.email ?? "")
	if (!firebaseUser)
	{
		const newUserId = await getNewUid();
		await getCollection("accounts").insertOne({uid: newUserId, sub: payload.sub, email: payload.email, verified: true, oAuth2: true})
		return true;
	}

	const account = await getCollection("accounts").findOne({uid: firebaseUser.uid})
	if (account)
	{
		await getCollection("accounts").updateOne({uid: firebaseUser.uid}, {$set: {sub: payload.sub}})
	}
	else
	{
		await getCollection("accounts").insertOne({uid: firebaseUser.uid, sub: payload.sub, email: firebaseUser.email, verified: true , oAuth2: true})
	}

	return true;
}