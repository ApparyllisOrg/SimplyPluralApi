import { ObjectId } from "mongodb"

export interface queryObject {
	uid: string
	[key: string]: any
}

export type dataInput = Map<string, unknown>
