import LRU from "lru-cache";

import { getCollection } from "../../../../modules/mongo";
import { update122 } from "./update112";
import { update150 } from "./update150";
import { update151 } from "./update151";
import { update300 } from "./update300";
const versionList = [111, 149, 150, 300];

export const FIELD_MIGRATION_VERSION = 300

const versionLRU = new LRU<string, boolean>({ max: 10000, ttl: 1000 * 5 });

export const doesUserHaveVersion = async (uid: string, version: number) : Promise<boolean> => 
{
	const userVersionString = `${uid}${version}`
	const LRUResult = versionLRU.get(userVersionString)
	if (LRUResult === true)
	{
		return true
	}

	if (LRUResult === false)
	{
		return false
	}

	const privateDoc = await getCollection("private").findOne({uid})
	if (privateDoc)
	{
		const hasVersion = privateDoc.latestVersion && privateDoc.latestVersion >= version
		versionLRU.set(userVersionString, hasVersion)
		return hasVersion
	}

	return false
}

export const updateUser = async (lastVersion: number, newVersion: number, uid: string) => {
	if (lastVersion >= newVersion) return;

	for (let i = 0; i < versionList.length; ++i) {
		const version = versionList[i];

		if (lastVersion >= version) continue;

		if (version == 111 && lastVersion < 111) {
			// Custom fields update
			await update122(uid);
		}

		if (version == 149 && lastVersion < 149) {
			// Public api update
			await update150(uid);
		}

		if (version == 150 && lastVersion < 150) {
			// Remove null info fields in members
			await update151(uid);
		}

		if (version == 300 && lastVersion < 300) {
			// Convert privacy fields to privacy buckets
			await update300(uid);
		}
	}
};
