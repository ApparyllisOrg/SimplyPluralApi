import { firestore } from "firebase-admin";
import { logger, userLog } from "../../../modules/logger";
import { getCollection } from "../../../modules/mongo";

export const createUser = async (uid: string) => {
	await getCollection("private").updateOne({ _id: uid, uid: uid }, { $set:{ uid: uid } }, { upsert: true });
	await getCollection("users").updateOne({ _id: uid, uid: uid }, { $set:{ uid: uid }}, { upsert: true });
};
