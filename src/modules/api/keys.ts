import { randomBytes } from "crypto";
import { isUserSuspended } from "../../security";
import { getCollection } from "../mongo";

export enum ApiKeyAccessType {
	Read = 0x01, // 0001
	Write = 0x02, // 0010
	Delete = 0x04 // 0100
}

export const FullApiAccess = ApiKeyAccessType.Read | ApiKeyAccessType.Write | ApiKeyAccessType.Delete;

export const generateNewApiKey = async (): Promise<string> => {
	const token = await randomBytes(48).toString("base64");

	//Check for collisions... Shouldn't happen but let's check it anyway
	const existingToken = await getCollection("tokens").findOne({
		token: token,
	});

	if (existingToken) {
		return await generateNewApiKey();
	}

	return token;
}

export const assignApiKey = async (read: boolean, write: boolean, del: boolean, token: string, uid: string): Promise<boolean> => {
	if (!write && !read && !del) return false;

	let permission = 0;
	if (read) permission |= ApiKeyAccessType.Read;
	if (write) permission |= ApiKeyAccessType.Write;
	if (del) permission |= ApiKeyAccessType.Delete;

	await getCollection("tokens").insertOne({
		"uid": uid,
		token: token,
		permission: permission
	});

	return true;
}

export const revokeApiKey = async (token: string, uid: string) => {
	await getCollection("tokens").deleteOne({ token: token, uid: uid });
}

export const revokeAllUserApiKeys = async (uid: string) => {
	await getCollection("tokens").deleteMany({ uid });
}

export const validateApiKey = async (token: string): Promise<{ valid: boolean, accessType: number, uid: string }> => {
	const doc = await getCollection("tokens").findOne({ "token": token });
	if (doc && doc.token) {

		// This may cause overhead, TODO: Implement lru-cache for this
		const isSuspended = await isUserSuspended(doc.uid)
		if (isSuspended)
		{
			return { valid: false, accessType: 0x00, uid: "" };
		}

		return { valid: true, accessType: doc.permission, uid: doc.uid };
	}

	return { valid: false, accessType: 0x00, uid: "" };
}

export const hasAccess = (access: number, accessToCheck: ApiKeyAccessType) => {
	return access & accessToCheck;
}

export const getUserApiKeys = async (uid: string): Promise<{ uid: string, token: string, permission: number }[]> => {
	const doc = await getCollection("tokens").find({ uid: uid },).toArray();
	return doc;
}
