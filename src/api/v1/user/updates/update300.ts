import assert from "assert";
import { getCollection } from "../../../../modules/mongo";
import {LexoRank} from "lexorank";

// Create 2 new privacy buckets
export const update300 = async (uid: string) => {

    if (process.env.DEVELOPMENT === "true")
    {
        await rollback300(uid)
    }

    const friendData : {uid: string, name: string, icon: string, rank: string, desc: string, color: string, _id?: any } = {uid, name: "Friends", icon: "🔓", rank: "0|aaaaaa:", desc: "A bucket for all your friends", color: "#C99524",}
    const trustedFriendData : {uid: string, name: string, icon: string, rank: string, desc: string, color: string, _id?: any }  = {uid, name: "Trusted friends", icon: "🔒", rank: "0|zzzzzz:", desc: "A bucket for all your trusted friends", color: "#1998A8"}

    // insertOne mutates the original object, adding _id as a valid parameter
    const friend = await getCollection("privacyBuckets").insertOne(friendData)
    const trustedFriend = await getCollection("privacyBuckets").insertOne(trustedFriendData)

    const applyBucketsToData = async (collection: string) => 
    {
        const collectionData = await getCollection(collection).find({ uid }).toArray();

        const applyBucketsPromises = []
        
        for (let i = 0; i < collectionData.length; ++i) {
            const member = collectionData[i];
            if (member.private !== false && member.preventTrusted !== false)
            {
                // Do nothing, assign no buckets
            } 
            else if (member.private !== false)
            {
                applyBucketsPromises.push(getCollection(collection).updateOne({uid, _id: member._id}, {$set: { buckets: [ trustedFriendData._id ]}}))
            }
            else 
            {
                applyBucketsPromises.push(getCollection(collection).updateOne({uid, _id: member._id}, {$set: { buckets: [ friendData._id ]}}))
            }
        }
    
        await Promise.all(applyBucketsPromises)
    }

    await applyBucketsToData("members")
    await applyBucketsToData("groups")
    await applyBucketsToData("frontStatuses")

    const applyFriendBucketsPromises = []

    const friends = await getCollection("friends").find({ uid }).toArray()

    for (let i = 0; i < friends.length; ++i)
    {
        const friendEntry = friends[i]
        if (friendEntry.seeMembers !== false && friendEntry.trusted !== false)
        {
            applyFriendBucketsPromises.push(getCollection("friends").updateOne({uid, frienduid: friendEntry.frienduid}, {$set: { buckets: [ trustedFriendData._id ]}}))
        }
        else if (friendEntry.seeMembers !== false)
        {
            applyFriendBucketsPromises.push(getCollection("friends").updateOne({uid, frienduid: friendEntry.frienduid}, {$set: { buckets: [ friendData._id ]}}))
        }
        else 
        {
            // This friend has no permissions to see data
        }
    }

    await Promise.all(applyFriendBucketsPromises)

    const user = await getCollection("users").findOne({ _id: uid, uid })
    assert(user)

    if (!user.fields)
    {
        // User has no custom fields to migrate
        return;
    }

    const fields :  {[key: string] : {name: string, order: number | string, private: boolean, preventTrusted: boolean, type: number, supportMarkdown: boolean }} = user.fields

    const createFieldsPromises : any[] = []

    const fieldKeys = Object.keys(fields)

    // We can assume numbers pre-migration
    fieldKeys.sort((a, b) => (fields[a].order as number) - (fields[b].order as number))

    if (fieldKeys.length == 1)
    {
        fields[fieldKeys[0]].order = "0|aaaaaa:"
    }
    else if (fieldKeys.length >= 2)
    {
        fields[fieldKeys[0]].order = "0|aaaaaa:"
        fields[fieldKeys[fieldKeys.length - 1]].order = "0|zzzzzz:"

        for (let i = 1; i < fieldKeys.length - 1; ++i)
        {
            const parsedPrevRank = LexoRank.parse(fields[fieldKeys[i - 1]].order as string);
            const parsedNextRank = LexoRank.parse(fields[fieldKeys[fieldKeys.length - 1]].order as string);

            fields[fieldKeys[i]].order = parsedPrevRank.between(parsedNextRank).format()
        }
    }

    fieldKeys.forEach((key) =>
    {
        const field = fields[key]!

        let bucketsToAdd : any[] = []

        if (field.private !== false && field.preventTrusted !== false)
        {
            // Do nothing, assign no buckets
        } 
        else if (field.private !== false)
        {
            bucketsToAdd = [ trustedFriendData._id ]
        }
        else 
        {
            bucketsToAdd =  [ friendData._id ]
        }

        // oid = original id
        createFieldsPromises.push(getCollection("customFields").insertOne({uid, name: field.name, order: field.order, type: field.type, supportMarkdown: field.supportMarkdown ,buckets: bucketsToAdd, oid: key }))
    });

    await Promise.all(createFieldsPromises)


    const createdFields = await getCollection("customFields").find({uid}).toArray()

    const renameOperation : { [key: string] : string } = {}

    createdFields.forEach((field) => 
    {
        renameOperation[`info.${field.oid}`] = `info.${field._id}`
    })

    getCollection("members").updateMany({ uid }, { $rename: renameOperation})
};

const rollback300 = async (uid: string) =>
{
    const createdFields = await getCollection("customFields").find({uid}).toArray()

    const renameOperation : { [key: string] : string } = {}

    createdFields.forEach((field) => 
    {
        renameOperation[`info.${field._id.toString()}`] = `info.${field.oid}`
    })

    await getCollection("members").updateMany({ uid }, { $rename: renameOperation})

    await getCollection("customFields").deleteMany({ uid })
    await getCollection("privacyBuckets").deleteMany({ uid })
    await getCollection("members").updateMany({ uid }, { $unset: { buckets: ""}})
    await getCollection("frontStatuses").updateMany({ uid }, { $unset: { buckets: ""}})
    await getCollection("groups").updateMany({ uid }, { $unset: { buckets: ""}})
    await getCollection("friends").updateMany({ uid }, { $unset: { buckets: ""}})
}
