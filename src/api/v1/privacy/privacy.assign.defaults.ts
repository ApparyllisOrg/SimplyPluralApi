import { getCollection } from "../../../modules/mongo"

export const insertDefaultPrivacyBuckets = async (uid: string, data: any, type: 'members' | 'groups' | 'customFields' | 'customFronts') => 
{
    const privateDocument = await getCollection("private").findOne({uid, _id: uid}, {projection: { defaultPrivacy: 1 }})
    if (privateDocument && privateDocument.defaultPrivacy)
    {
        data.buckets = privateDocument.defaultPrivacy[type] ?? []
    }
    else 
    {
        data.buckets = []
    }
}