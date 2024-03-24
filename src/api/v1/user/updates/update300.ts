import { getCollection } from "../../../../modules/mongo";

// Create 2 new privacy buckets
export const update300 = async (uid: string) => {

    const friendData : {uid: string, name: string, icon: string, rank: string, desc: string, color: string, _id?: any } = {uid, name: "Friends", icon: "🔓", rank: "0|aaaaaa:", desc: "A bucket for all your friends", color: "#C99524",}
    const trustedFriendData : {uid: string, name: string, icon: string, rank: string, desc: string, color: string, _id?: any }  = {uid, name: "Trusted friends", icon: "🔒", rank: "0|zzzzzz:", desc: "A bucket for all your trusted friends", color: "#1998A8"}

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
    await applyBucketsToData("customFronts")

    const applyFriendBucketsPromises = []

    const friends = await getCollection("friends").find({ uid }).toArray()

    for (let i = 0; i < friends.length; ++i)
    {
        const friendEntry = friends[i]
        if (friendEntry.seeMembers !== false && friendEntry.trusted !== false)
        {
            applyFriendBucketsPromises.push(getCollection("friends").updateOne({uid, frienduid: friendEntry.frienduid}, {$set: { privacyBuckets: [ trustedFriendData._id ]}}))
        }
        else if (friendEntry.seeMembers !== false)
        {
            applyFriendBucketsPromises.push(getCollection("friends").updateOne({uid, frienduid: friendEntry.frienduid}, {$set: { privacyBuckets: [ friendData._id ]}}))
        }
        else 
        {
            // This friend has no permissions to see data
        }
    }

    await Promise.all(applyFriendBucketsPromises)
};
