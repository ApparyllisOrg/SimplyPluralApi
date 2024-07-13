import { ObjectId } from "mongodb"
import { getCollection, parseId } from "../../../modules/mongo"
import { PrivacyBucketDocument } from "../../types/document"

export const insertDefaultPrivacyBuckets = async (uid: string, data: PrivacyBucketDocument, type: "members" | "groups" | "customFields" | "customFronts") => {
	const privateDocument = await getCollection("private").findOne({ uid, _id: uid }, { projection: { defaultPrivacy: 1 } })
	if (privateDocument && privateDocument.defaultPrivacy) {
		const newbuckets: ObjectId[] = []

		const defaultBuckets: string[] = privateDocument.defaultPrivacy[type] ?? []
		defaultBuckets.forEach((bucket) => newbuckets.push(parseId(bucket) as ObjectId))

		data.buckets = newbuckets
	} else {
		data.buckets = []
	}
}
