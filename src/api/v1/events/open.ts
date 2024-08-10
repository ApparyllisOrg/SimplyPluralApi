import { getCollection } from "../../../modules/mongo";
import { getStartOfDay } from "../../../util";

export const logOpenUsage = async (uid: string | undefined) => {
	if (uid === undefined) {
		return;
	}

	const privateUser = await getCollection("private").findOne({ uid: uid });

	if (!privateUser) {
		return;
	}

	const lastRefresh = privateUser.lastRefresh ?? 0;

	if (lastRefresh < getStartOfDay().valueOf()) {
		await getCollection("private").updateOne({ uid: uid, _id: uid }, { $set: { lastRefresh: getStartOfDay().valueOf() } });
		await getCollection("events").updateOne({ date: getStartOfDay().toDate(), event: "dailyUsage" }, { $inc: { count: 1 } }, { upsert: true });
	}
};
