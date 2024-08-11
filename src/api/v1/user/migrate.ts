import { getCollection } from "../../../modules/mongo"

export const createUser = async (uid: string, latestVersion: number | null) => {
	if (latestVersion === null) {
		await getCollection("private").updateOne({ _id: uid, uid: uid }, { $set: { uid: uid } }, { upsert: true })
	} else {
		await getCollection("private").updateOne({ _id: uid, uid: uid }, { $set: { uid: uid, latestVersion } }, { upsert: true })
	}

	await getCollection("users").updateOne({ _id: uid, uid: uid }, { $set: { uid: uid } }, { upsert: true })
}
