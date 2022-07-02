import { randomBytes } from "crypto";
import { SimplyPluralDb } from "../../util/types";
import { getCollection } from "../mongo";

export enum ApiKeyAccessType {
	Read = 0x01, // 0001
	Write = 0x02, // 0010
	Delete = 0x04 // 0100
}

export const FullApiAccess = ApiKeyAccessType.Read | ApiKeyAccessType.Write | ApiKeyAccessType.Delete;

export const generateNewApiKey = async (): Promise<string> => {
	const token = await randomBytes(48);

	//Check for collisions... Shouldn't happen but let's check it anyway
	const existingToken = await getCollection("tokens", SimplyPluralDb).findOne({
		token: token,
	});

	if (existingToken) {
		return await generateNewApiKey();
	}

	return token.toString("base64");
}

export const assignApiKey = async (read: boolean, write: boolean, del: boolean, token: string, uid: string): Promise<boolean> => {
	if (!write && !read && !del) return false;

	let permission = 0;
	if (read) permission |= ApiKeyAccessType.Read;
	if (write) permission |= ApiKeyAccessType.Write;
	if (del) permission |= ApiKeyAccessType.Delete;

	await getCollection("tokens", SimplyPluralDb).insertOne({
		"uid": uid,
		token: token,
		permission: permission
	});

	return true;
}

export const revokeApiKey = async (token: string, uid: string) => {
	await getCollection("tokens", SimplyPluralDb).deleteOne({ token: token, uid: uid });
}

export const revokeAllUserApiKeys = async (uid: string) => {
	await getCollection("tokens", SimplyPluralDb).deleteMany({ uid });
}

export const validateApiKey = async (token: string): Promise<{ valid: boolean, accessType: number, uid: string }> => {
	const doc = await getCollection("tokens", SimplyPluralDb).findOne({ "token": token });
	if (doc && doc.token) {
		return { valid: false, accessType: doc.permission, uid: doc.uid };
	}

	return { valid: false, accessType: 0x00, uid: "" };
}

export const hasAccess = (access: number, accessToCheck: ApiKeyAccessType) => {
	return access & accessToCheck;
}

export const getUserApiKeys = async (uid: string): Promise<{ uid: string, token: string, permission: number }[]> => {
	const doc = await getCollection("tokens", SimplyPluralDb).find({ uid: uid },).toArray();
	return doc;
}
