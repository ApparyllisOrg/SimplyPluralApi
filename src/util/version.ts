import LRU from "lru-cache"
import { ObjectId } from "mongodb"
import { getCollection } from "../modules/mongo"

//-------------------------------//
// Release Names
//-------------------------------//

export const ONE_ELEVEN = 300
export const ONE_TWELVE = 400

//-------------------------------//
// Versioning
//-------------------------------//

export const versionMigrationList = [111, 149, 150, ONE_ELEVEN]

//-------------------------------//
// Utils
//-------------------------------//

const versionLRU = new LRU<string, boolean>({ max: 10000, ttl: 1000 * 5 })

export const doesUserHaveVersion = async (uid: string, version: number): Promise<boolean> => {
	const userVersionString = `${uid}${version}`
	const LRUResult = versionLRU.get(userVersionString)
	if (LRUResult === true) {
		return true
	}

	if (LRUResult === false) {
		return false
	}

	const privateDoc: { _id: string | ObjectId; latestVersion: number | undefined } = await getCollection("private").findOne({ uid, _id: uid }, { projection: { latestVersion: 1 } })

	if (privateDoc) {
		const hasVersion: boolean = privateDoc.latestVersion !== null && privateDoc.latestVersion !== undefined && privateDoc.latestVersion >= version
		versionLRU.set(userVersionString, hasVersion)
		return hasVersion
	}

	return false
}
