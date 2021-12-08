import { Request, Response } from "express";
import { firestore } from "firebase-admin";
import { logger, userLog } from "../../../modules/logger";
import { getCollection } from "../../../modules/mongo";

const convertTime = (data: { [field: string]: any }) => {
	if (!data) return;
	for (const key in data) {
		if (data[key]) {
			if (data[key].prototype.hasOwnProperty.call("_seconds")) {
				const newValue = data[key]["_seconds"] * 1000 + data[key]["_nanoseconds"] / 10000000;
				data[key] = Math.round(newValue);
			}
		}
	}
};

export const migrateUser = async (_req: Request, res: Response) => {
	const serverUser = await getCollection("serverData").findOne({ uid: res.locals.uid });
	if (!serverUser || !serverUser.migrated) {
		const pubMembers = await firestore().collection("users").doc(res.locals.uid).collection("publicMembers").get();

		const privMembers = await firestore().collection("users").doc(res.locals.uid).collection("privateMembers").get();

		const notes = await firestore().collection("users").doc(res.locals.uid).collection("notes").get();
		const frontHistory = await firestore().collection("users").doc(res.locals.uid).collection("frontHistory").get();

		const polls = await firestore().collection("users").doc(res.locals.uid).collection("polls").get();

		const frontStatuses = await firestore().collection("users").doc(res.locals.uid).collection("frontStatuses").get();

		const fronters = await firestore().collection("users").doc(res.locals.uid).collection("fronters").get();

		const groups = await firestore().collection("users").doc(res.locals.uid).collection("groups").get();

		const shared = await firestore().collection("users").doc(res.locals.uid).collection("shared").doc("fronters").get();

		const privateDoc = await firestore().collection("users").doc(res.locals.uid).collection("private").doc("data").get();

		const user = await firestore().collection("users").doc(res.locals.uid).get();

		const membersBatch: any[] = [];
		{
			privMembers.docs.forEach((doc): any => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				data["private"] = true;
				convertTime(data);
				membersBatch.push(data);
			});

			pubMembers.docs.forEach((doc): any => {
				const data = doc.data();
				data._id = doc.id;

				if (!membersBatch.includes({ _id: doc.id })) {
					data.uid = res.locals.uid;
					data["private"] = false;
					convertTime(data);
					membersBatch.push(data);
				}
			});
		}
		const notesBatch: any[] = [];
		{
			notes.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				notesBatch.push(data);
			});
		}
		const frontHistoryBatch: any[] = [];
		{
			frontHistory.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				frontHistoryBatch.push(data);
			});
		}
		const pollsBatch: any[] = [];
		{
			polls.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				pollsBatch.push(data);
			});
		}

		const frontStatusesBatch: any[] = [];
		{
			frontStatuses.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				frontStatusesBatch.push(data);
			});
		}
		const frontersBatch: any[] = [];
		{
			fronters.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				frontersBatch.push(data);
			});
		}
		const groupsBatch: any[] = [];
		{
			groups.docs.forEach((doc) => {
				const data = doc.data();
				data._id = doc.id;
				data.uid = res.locals.uid;
				convertTime(data);
				groupsBatch.push(data);
			});
		}

		let data: { [field: string]: any } = privateDoc.data()!;
		if (data == null) {
			data = {};
		}

		data["latestVersion"] = 76;
		data["uid"] = res.locals.uid;
		data["_id"] = res.locals.uid;

		if (membersBatch.length > 0) getCollection("members").insertMany(membersBatch);
		if (notesBatch.length > 0) getCollection("notes").insertMany(notesBatch);
		if (frontHistoryBatch.length > 0) getCollection("frontHistory").insertMany(frontHistoryBatch);
		if (pollsBatch.length > 0) getCollection("polls").insertMany(pollsBatch);
		if (frontStatusesBatch.length > 0) getCollection("frontStatuses").insertMany(frontStatusesBatch);
		if (frontersBatch.length > 0) getCollection("fronters").insertMany(frontersBatch);
		if (groupsBatch.length > 0) getCollection("groups").insertMany(groupsBatch);

		await getCollection("private").updateOne({ _id: res.locals.uid, uid: res.locals.uid }, { $set: data }, { upsert: true });

		let userData: { [field: string]: any } = user.data()!;
		if (!userData) {
			userData = {};
		}

		userData["isAsystem"] = data["isAsystem"] != null ? data["isAsystem"] : true;
		userData["fromFirebase"] = true;
		userData["uid"] = res.locals.uid;
		userData["_id"] = res.locals.uid;

		let sharedData: { [field: string]: any } = shared.data()!;
		if (!sharedData) {
			sharedData = {};
		}

		sharedData["uid"] = res.locals.uid;
		sharedData["_id"] = res.locals.uid;

		await getCollection("sharedFront")
			.updateOne({ _id: res.locals.uid, uid: res.locals.uid }, { $set: sharedData }, { upsert: true });
		await getCollection("users").updateOne({ _id: res.locals.uid, uid: res.locals.uid }, { $set: userData }, { upsert: true });

		const friends = await firestore().collection("users").doc(res.locals.uid).collection("friends").get();

		for (let i = 0; i < friends.size; ++i) {
			const friend = friends.docs[i];
			const foundUser = await getCollection("users").findOne({ uid: friend.id });
			if (foundUser) {
				const otherFriendSettings = await firestore().collection("users").doc(friend.id).collection("friends").doc(res.locals.uid).get();
				if (!otherFriendSettings) {
					await getCollection("friends")
						.updateOne(
							{ uid: friend.id, frienduid: res.locals.uid },
							{
								$set: {
									uid: friend.id,
									frienduid: res.locals.uid,
									getFrontNotif: false,
									getTheirFrontNotif: false,
									seeFront: false,
									seeMembers: false,
								},
							},
							{ upsert: true }
						)
						.catch((e) => logger.error(e));
				} else {
					{
						const { getFrontNotif, getTheirFrontNotif, seeFront, seeMembers } = otherFriendSettings.data()!;
						await getCollection("friends")
							.updateOne(
								{ uid: friend.id, frienduid: res.locals.uid },
								{
									$set: {
										uid: friend.id,
										frienduid: res.locals.uid,
										getFrontNotif: getFrontNotif,
										getTheirFrontNotif: getTheirFrontNotif,
										seeFront: seeFront,
										seeMembers: seeMembers,
									},
								},
								{ upsert: true }
							)
							.catch((e) => logger.error(e));
					}
				}
				{
					const { getFrontNotif, getTheirFrontNotif, seeFront, seeMembers } = friend.data();

					await getCollection("friends")
						.updateOne(
							{ uid: res.locals.uid, frienduid: friend.id },
							{
								$set: {
									uid: res.locals.uid,
									frienduid: friend.id,
									getFrontNotif: getFrontNotif,
									getTheirFrontNotif: getTheirFrontNotif,
									seeFront: seeFront,
									seeMembers: seeMembers,
								},
							},
							{ upsert: true }
						)
						.catch((e) => logger.error(e));
				}

				//notifyUser(friend.id, "Friend migrated", self.username)
			}
		}
	}

	userLog(res.locals.uid, "Migrated");

	getCollection("serverData")
		.updateOne({ uid: res.locals.uid }, { $set: { migrated: true } }, { upsert: true });

	res.status(200).send();
};
