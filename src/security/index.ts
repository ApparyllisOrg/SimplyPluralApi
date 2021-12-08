import * as Mongo from "../modules/mongo";
import LRU from "lru-cache";
const users = "users";
const groups = "groups";
const members = "members";
const fronters = "fronters";
const frontStatuses = "frontStatuses";
const friends = "friends";
const friendReqs = "pendingFriendRequests";
const sharedFront = "sharedFront";
const privateFront = "privateFront";

export const friendReadCollections = [users, members, fronters, frontStatuses, friends, friendReqs, groups, sharedFront, privateFront];

export enum FriendLevel {
	None = 0x00,
	Pending = 0x01,
	Friends = 0x02,
	Trusted = 0x03
}

const friendLevelLRU = new LRU<string, FriendLevel>({ max: 10000, maxAge: 1000 * 5 });

export const getFriendLevel = async (a: string, b: string): Promise<FriendLevel> => {

	const cacheLevel = friendLevelLRU.get(a + b);
	if (cacheLevel) {
		return cacheLevel;
	}

	const friendDoc = await Mongo.db().collection("friends").findOne({ uid: b, frienduid: a });
	if (!friendDoc) {

		const pendingDoc = await Mongo.db().collection("pendingFriendRequests").findOne({
			$or: [
				{ sender: a, receiver: b },
				{ sender: b, receiver: a },
			],
		});

		if (pendingDoc) {
			friendLevelLRU.set(a + b, FriendLevel.Pending);
			return FriendLevel.Pending;
		}

		friendLevelLRU.set(a + b, 0);
		return FriendLevel.None;
	}

	let friendLevel = FriendLevel.Friends;
	if (friendDoc.trusted) {
		friendLevel = FriendLevel.Friends | FriendLevel.Trusted;
	}

	friendLevelLRU.set(a + b, friendLevel);
	return friendLevel;
};

export const isPendingFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel & FriendLevel.Pending);
export const isFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel & FriendLevel.Friends || friendLevel & FriendLevel.Trusted);
export const isTrustedFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel & FriendLevel.Trusted);