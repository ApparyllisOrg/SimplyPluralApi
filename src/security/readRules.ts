import { ObjectId } from "mongodb"
import { SimplyDocument } from "../api/types/document"
export interface UserField {
	_id?: ObjectId
	name: string
	order: number
	private: boolean
	type: number
	preventTrusted: boolean
}

export interface UserItem {
	_id?: ObjectId
	fields: Map<string, UserField>
}

export const parseForAllowedReadValues = async (data: SimplyDocument, requestorUid: string) => {
	if (data && data.uid !== requestorUid) {
		delete data["comments"]
	}
}
