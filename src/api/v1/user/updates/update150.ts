import { getCollection, parseId } from "../../../../modules/mongo"

export const update150 = async (uid: string) => {

	const fhCollection = getCollection("frontHistory")
	const memberCollection = getCollection("members")
	const frontHistoryForUser = await fhCollection.find({ uid }).toArray()
	const commentsToInsert = []
	for (let i = 0; i < frontHistoryForUser.length; ++i) {
		const entry = frontHistoryForUser[i]
		const comments: { time: { _seconds: number, _nanoseconds: number }, text: string }[] = entry.comments

		if (!comments)
			continue

		for (let j = 0; j < comments.length; ++j) {
			// Convert seconds to milliseconds
			commentsToInsert.push({ uid, time: comments[j].time._seconds * 1000, text: comments[j].text, collection: "frontHistory", documentId: entry._id })
		}
	}

	await getCollection("comments").insertMany(commentsToInsert)

	const fronters = await getCollection("fronters").find({ uid }).toArray()

	for (let i = 0; i < fronters.length; ++i) {
		const fronter = fronters[i]
		const foundMember = await memberCollection.findOne({ _id: parseId(fronter.member) })
		await fhCollection.insertOne({ uid, member: fronter._id, startTime: fronter.startTime, live: true, custom: !foundMember })
	}
}