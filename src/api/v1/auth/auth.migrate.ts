import { auth } from "firebase-admin";
import { config } from "../../../modules/config";

//-------------------------------//
// Perform post-migration on a firebase user
//-------------------------------//
export const migrateAccountFromFirebase = async (uid: string) => {
	if (config().firebase) {
		await auth().updateUser(uid, { disabled: true }).catch((r) => undefined);
	}
};
