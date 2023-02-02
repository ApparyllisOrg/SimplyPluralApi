// Usage module for the Apparyllis API. Keep track of usage for the API to keep fair use in check.
// If we notice that a particular user is calling the API a lot more than others we can react to it using
// the usage stats, where otherwise we wouldn't know who actually did what on the API, other than an IP which is not really useful, especially when behind a VPN.
// The stats aren't meant to keep track of normal usage, only there for abuse of API.
import moment from "moment";
import * as Mongo from "./mongo";

const collectedUsage: Map<string, Map<string, number>> = new Map<string, Map<string, number>>();
let collectedUsageCount = 0;

export const startCollectingUsage = () => {
	collectUsage();
};

const collectUsage = () => {
	const expirationMoment = moment().add(14, "days").startOf("day").toDate().toISOString();

	const expirationDate: Date = new Date(expirationMoment);

	collectedUsage.forEach((value, key) => {
		const updateObj: { [key: string]: any } = {};

		value.forEach((count, method) => {
			updateObj[method] = count;
		});

		Mongo.getCollection("usage").updateOne({ uid: key, expireAt: expirationDate }, { $inc: updateObj }, { upsert: true });
	});

	collectedUsage.clear();

	console.log(`Dumped ${collectedUsageCount} actions to the usage logs`);

	collectedUsageCount = 0;

	setTimeout(collectUsage, 1000 * 10);
};

export const logUserUsage = (uid: string, action: string) => {
	if (!collectedUsage.has(uid)) {
		collectedUsage.set(uid, new Map<string, number>());
	}

	const userUsage = collectedUsage.get(uid);
	if (userUsage) {
		if (userUsage.has(action)) {
			let previousCount = userUsage.get(action);
			if (!previousCount) {
				previousCount = 0;
			}

			userUsage.set(action, previousCount + 1);
			collectedUsageCount++;
		} else {
			userUsage.set(action, 1);
			collectedUsageCount++;
		}
	}
};
