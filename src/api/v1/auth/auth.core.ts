import { randomBytes } from "crypto";
import { getCollection } from "../../../modules/mongo";

//-------------------------------//
// Get a new valid uid that can be used for a user
//-------------------------------//
export const getNewUid = async () => {
	let randomUid = randomBytes(32).toString("hex")
	const existingUser =  await getCollection("accounts").findOne({uid: randomUid})
	// If it already exists (unlikely) try again until we find one that isn't taken yet
	if (existingUser)
	{
		randomUid = await getNewUid()
	}

	return randomUid;
}
