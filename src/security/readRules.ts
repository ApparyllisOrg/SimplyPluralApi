import { ObjectId } from "mongodb";
import { documentObject } from "../modules/mongo/baseTypes";

export interface UserField {
	_id?: ObjectId,
	name: string,
	order: number,
	private: boolean,
	type: number,
	preventTrusted: boolean
}

export interface UserItem {
	_id?: ObjectId,
	fields: Map<string, UserField>
}

export const parseForAllowedReadValues = async (data: documentObject, requestorUid: string) => {
	if (data.uid !== requestorUid) {
		delete data["comments"];
	}
};