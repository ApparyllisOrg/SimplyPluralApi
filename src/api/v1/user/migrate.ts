import { getCollection } from "../../../modules/mongo";
import { versionMigrationList } from "./updates/updateUser";

export const createUser = async (uid: string) => {
	await getCollection("private").updateOne({ _id: uid, uid: uid }, { $set: { uid: uid, latestVersion: versionMigrationList[versionMigrationList.length -1] } }, { upsert: true });
	await getCollection("users").updateOne({ _id: uid, uid: uid }, { $set: { uid: uid } }, { upsert: true });
};
