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

		fhCollection.updateOne({ _id: entry._id }, { $set: { commentCount: comments.length } });
	}

	if (commentsToInsert.length > 0)
		await getCollection("comments").insertMany(commentsToInsert)

	const fronters = await getCollection("fronters").find({ uid }).toArray()

	for (let i = 0; i < fronters.length; ++i) {
		const fronter = fronters[i]
		const foundMember = await memberCollection.findOne({ _id: parseId(fronter.member) })
		await fhCollection.insertOne({ uid, member: fronter._id, startTime: fronter.startTime, live: true, custom: !foundMember })
	}


	const convertBinaryVotes = (votes: { id: string, comment: string, vote: string }[], toConvert: any[] | undefined, vote: string) => {
		if (toConvert) {
			for (let i = 0; i < toConvert.length; ++i) {
				const oldVote = toConvert[i];
				if (typeof oldVote === "string") {
					votes.push({ id: oldVote, vote: vote, comment: "" });
				}
				else {
					const oldVoteObj: { id: string, comment: string } = oldVote;
					votes.push({ id: oldVoteObj.id, vote: vote, comment: oldVoteObj.comment });
				}
			}
		}
	}

	const polls = await getCollection("polls").find({ uid }).toArray();
	for (let i = 0; i < polls.length; ++i) {
		const poll = polls[i]

		const yes = poll.yes
		const no = poll.no
		const abstain = poll.abstain
		const veto = poll.veto

		const votes: { id: string, comment: string, vote: string }[] = []

		convertBinaryVotes(votes, yes, "yes");
		convertBinaryVotes(votes, no, "no");
		convertBinaryVotes(votes, abstain, "abstain");
		convertBinaryVotes(votes, veto, "veto");

		const oldVotes: { [key: string]: { comment: string, vote: string } }[] | undefined = poll.votes

		if (oldVotes) {
			for (let i = 0; i < oldVotes.length; ++i) {
				const oldVote: { [key: string]: { comment: string, vote: string } } = oldVotes[i];
				const prop = Object.getOwnPropertyNames(oldVote)[0];
				votes.push({ id: prop, vote: oldVote[prop].vote, comment: oldVote[prop].comment });
			}
		}

		await getCollection("polls").updateOne({ _id: parseId(poll._id), uid }, { $set: { votes } });
	}
}