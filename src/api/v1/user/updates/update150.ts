import { getCollection } from "../../../../modules/mongo"

export const update150 = async (uid: string) => {
	const frontHistoryForUser = await getCollection("frontHistory").find({ uid }).toArray()
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
}