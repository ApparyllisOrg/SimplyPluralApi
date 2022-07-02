import { update122 } from "./update112";
import { update150 } from "./update150";
import { update151 } from "./update151";

const versionList = [111, 149, 150]

export const updateUser = async (lastVersion: number, newVersion: number, uid: string) => {
	if (lastVersion >= newVersion)
		return;

	for (let i = 0; i < versionList.length; ++i)
	{
		const version = versionList[i]

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
	}
}