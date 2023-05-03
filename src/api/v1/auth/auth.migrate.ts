import { auth } from "firebase-admin";

//-------------------------------//
// Perform post-migration on a firebase user
//-------------------------------//
export const migrateAccountFromFirebase = async (uid: string) => {
	if (process.env.PRETESTING !== "true") {
		await auth().updateUser(uid, { disabled: true }).catch((r) => undefined);
	}
};
