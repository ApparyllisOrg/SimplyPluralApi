import { randomBytes } from "crypto";
import moment from "moment";
import { getCollection } from "../../../modules/mongo";
import { getUserConnections } from "../../../modules/socket";

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//
export const getNewUid = async () => {
	let randomUid = randomBytes(32).toString("hex");
	const existingUser = await getCollection("accounts").findOne({ uid: randomUid });
	// If it already exists (unlikely) try again until we find one that isn't taken yet
	if (existingUser) {
		randomUid = await getNewUid();
	}

	return randomUid;
};

//-------------------------------//
// Revokes all user access
//-------------------------------//
export const revokeAllUserAccess = async (uid: string) => {
	// Division by 1000 because iat is in seconds, not milliseconds
	await getCollection("accounts").updateOne({ uid }, { $set: { firstValidJWtTime: Math.round(moment.now() / 1000) } });

	getUserConnections(uid).forEach((connection) => connection.send("Session invalidated", true));
};

//-------------------------------//
// Get Password Regex for the API
//-------------------------------//
export  const getPasswordRegex = () => "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,100}$"
export const passwordRegexError = "Your password must be between 12 and 100 characters, have a capital and lower case letter, a number and a symbol (#?!@$%^&*-)";
