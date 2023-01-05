import { logger } from "../logger";
import { getCollection, parseId } from "../mongo";
import { notifyUser } from "../notifications/notifications";
import { notifyOfFrontChange } from "./automatedReminder";
import { performEvent } from "./eventController";

export const frontChange = async (uid: string, removed: boolean, memberId: string, notifyReminders: boolean) => {

	if (notifyReminders === true)
	{
		notifyOfFrontChange(uid, removed, memberId)
	}

	const sharedCollection = getCollection("sharedFront");
	const privateCollection = getCollection("privateFront");
	const frontersCollection = getCollection("frontHistory");
	let sharedData = await sharedCollection.findOne({ uid: uid, _id: uid });
	let privateData = await privateCollection.findOne({ uid: uid, _id: uid });
	const frontersData = await frontersCollection.find({ uid: uid, live: true }).toArray();

	// Can be null if the user is new :)
	if (!sharedData) {
		sharedData = {};
	}

	if (!privateData) {
		privateData = {};
	}

	const members = getCollection("members");
	const frontStatuses = getCollection("frontStatuses");

	const fronterNames: Array<string> = [];
	const fronterNotificationNames: Array<string> = [];
	const customFronterNames: Array<string> = [];

	const privateFronterNames: Array<string> = [];
	const privateFronterNotificationNames: Array<string> = [];
	const privateCustomFronterNames: Array<string> = [];

	for (let i = 0; i < frontersData.length; ++i) {
		const fronter = frontersData[i];
		if (fronter.custom) {
			const doc = await frontStatuses.findOne({ uid: uid, _id: parseId(fronter.member) });
			if (doc !== null) {
				if (doc.private !== undefined && doc.private !== null && !doc.private) {
					customFronterNames.push(doc.name);
					privateCustomFronterNames.push(doc.name);
				} else if (doc.preventTrusted !== true) {
					privateCustomFronterNames.push(doc.name);
				}
			}
		} else {
			const doc = await members.findOne({ uid: uid, _id: parseId(fronter.member) });
			if (doc !== null) {
				if (doc.private !== undefined && doc.private !== null && doc.private === false) {
					if (doc.preventsFrontNotifs !== true) {
						fronterNotificationNames.push(doc.name);
						privateFronterNotificationNames.push(doc.name);
					}
					fronterNames.push(doc.name);
					privateFronterNames.push(doc.name);

				} else if (doc.preventTrusted !== true) {
					if (doc.preventsFrontNotifs !== true) {
						privateFronterNotificationNames.push(doc.name);
					}
					privateFronterNames.push(doc.name);
				}
			} else {
				logger.warn("cannot find " + fronter);
			}
		}
	}

	customFronterNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	fronterNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	fronterNotificationNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

	privateCustomFronterNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	privateFronterNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	privateFronterNotificationNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

	const getFronterString = (entries: Array<string>) => {
		const value = entries.join(", ");
		return value;
	};

	sharedCollection.updateOne(
		{ uid: uid, _id: uid },
		{
			$set: {
				fronters: fronterNames,
				customFronters: customFronterNames,
				frontString: getFronterString(fronterNames),
				customFrontString: getFronterString(customFronterNames),
				frontNotificationString: getFronterString(fronterNotificationNames),
			},
		},
		{ upsert: true }
	);

	privateCollection.updateOne(
		{ uid: uid, _id: uid },
		{
			$set: {
				fronters: privateFronterNames,
				customFronters: privateCustomFronterNames,
				frontString: getFronterString(privateFronterNames),
				customFrontString: getFronterString(privateCustomFronterNames),
				frontNotificationString: getFronterString(privateFronterNotificationNames),
				private: true,
			},
		},
		{ upsert: true }
	);

	const beforeFrontString = sharedData.beforeFrontNotificationString;
	const beforeCustomFrontString = sharedData.beforeCustomFrontString;

	const frontNotificationString = getFronterString(fronterNotificationNames);
	const customFrontString = getFronterString(customFronterNames);

	const friendCollection = getCollection("friends");
	const foundFriends = await friendCollection.find({ uid: uid }).toArray();

	if (beforeFrontString !== frontNotificationString || beforeCustomFrontString !== customFrontString) {
		performEvent("frontChangeShared", uid, 10 * 1000);
		sharedCollection
			.updateOne(
				{ uid: uid, _id: uid },
				{ $set: { beforeFrontNotificationString: frontNotificationString, beforeCustomFrontString: customFrontString } },
				{ upsert: true }
			)
			.catch(logger.error);
	}

	const privateBeforeFrontString = privateData.beforeFrontNotificationString;
	const privateBeforeCustomFrontString = privateData.beforeCustomFrontString;

	const privateFrontNotificationString = getFronterString(privateFronterNotificationNames);
	const priavteCustomFrontString = getFronterString(privateCustomFronterNames);

	if (privateBeforeFrontString !== privateFrontNotificationString || privateBeforeCustomFrontString !== priavteCustomFrontString) {
		performEvent("frontChangePrivate", uid, 10 * 1000);
		privateCollection
			.updateOne(
				{ uid: uid, _id: uid },
				{ $set: { beforeFrontNotificationString: privateFrontNotificationString, beforeCustomFrontString: priavteCustomFrontString } },
				{ upsert: true }
			)
			.catch(logger.error);

	}

	if (foundFriends.length <= 0) {
		return;
	}

};

export const notifySharedFrontDue = async (uid: string, _event: any) => {
	const sharedCollection = getCollection("sharedFront");
	const sharedData = await sharedCollection.findOne({ uid: uid, _id: uid });
	notifyFront(sharedData.frontNotificationString, sharedData.customFrontString, uid, false);
}

export const notifyPrivateFrontDue = async (uid: string, _event: any) => {
	const privateCollection = getCollection("privateFront");
	const privateData = await privateCollection.findOne({ uid: uid, _id: uid });
	notifyFront(privateData.frontNotificationString, privateData.customFrontString, uid, true);
}

const notifyFront = async (
	frontNotificationString: string,
	customFrontString: string,
	uid: string,
	trusted: boolean
) => {
	let message = "";

	if (frontNotificationString.length > 0) {
		if (customFrontString.length > 0) {
			message = "Fronting: " + frontNotificationString + " \n" + "Custom fronting: " + customFrontString;
		} else {
			message = "Fronting: " + frontNotificationString;
		}
	} else if (customFrontString.length > 0) {
		message = "Custom fronting: " + customFrontString;
	}

	// no public members to show as front.
	if (message.length <= 0) {
		return;
	}

	const userDoc = await getCollection("users").findOne({ uid: uid });

	const trustedQuery: any[] = [];
	if (trusted === false) {
		trustedQuery.push({ "trusted": false });
		trustedQuery.push({ "trusted": null });
	}
	else {
		trustedQuery.push({ "trusted": true });
	}

	const friendCollection = getCollection("friends")
	const foundFriends = await friendCollection.find({ uid: uid }).toArray();
	foundFriends.forEach(async (doc) => {
		const getFrontNotif = doc["getFrontNotif"];

		if (getFrontNotif) {
			const selfFriendSettings = await friendCollection.findOne({ frienduid: doc["frienduid"], uid: uid, $or: trustedQuery });
			const friendSettings = await friendCollection.findOne({ frienduid: uid, uid: doc["frienduid"] });
			if (friendSettings && selfFriendSettings && friendSettings["getTheirFrontNotif"]) {
				notifyUser(userDoc["uid"], doc["frienduid"], userDoc["username"], message);
			}
		}
	});
};
