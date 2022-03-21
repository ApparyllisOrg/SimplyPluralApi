import { update122 } from "./update112";
import { update150 } from "./update150";
import { update151 } from "./update151";

export const updateUser = async (lastVersion: number, newVersion: number, uid: string) => {
	if (lastVersion >= newVersion)
		return;

	if (lastVersion == 111) {
		// Custom fields update
		await update122(uid);
	}

	if (lastVersion == 149) {
		// Public api update
		await update150(uid);
	}

	if (lastVersion == 150) {
		// Remove null info fields in members
		await update151(uid);
	}

	await updateUser(lastVersion + 1, newVersion, uid);
}