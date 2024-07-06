import { ObjectId } from "mongodb"
import { getCollection, parseId } from "../../../modules/mongo"

export const insertDefaultPrivacyBuckets = async (uid: string, data: any, type: 'members' | 'groups' | 'customFields' | 'customFronts') => 
{
    const privateDocument = await getCollection("private").findOne({uid, _id: uid}, {projection: { defaultPrivacy: 1 }})
    if (privateDocument && privateDocument.defaultPrivacy)
    {
        const newbuckets : (string|ObjectId)[] = []

        const defaultBuckets : (string|ObjectId)[] = privateDocument.defaultPrivacy[type] ?? []
        defaultBuckets.forEach((bucket) => newbuckets.push(parseId(bucket)))
        
        data.buckets = newbuckets
    }
    else 
    {
        data.buckets = []
    }
}