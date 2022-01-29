import * as Mongo from "../modules/mongo";
import LRU from "lru-cache";
const users = "users";
const groups = "groups";
const members = "members";
const frontStatuses = "frontStatuses";
const sharedFront = "sharedFront";
const privateFront = "privateFront";
const friends = "friends";
const front = "front";

export const friendReadCollections = [users, members, frontStatuses, groups, sharedFront, privateFront, friends, front];

export enum FriendLevel {
	None = 0,
	Pending = 1,
	Friends = 2,
	Trusted = 3
}

const friendLevelLRU = new LRU<string, FriendLevel>({ max: 10000, maxAge: 1000 * 5 });
const seeMembersLRU = new LRU<string, boolean>({ max: 10000, maxAge: 1000 * 5 });

export const getFriendLevel = async (owner: string, requestor: string): Promise<FriendLevel> => {

	const cacheLevel = friendLevelLRU.get(owner + requestor);
	if (cacheLevel) {
		return cacheLevel;
	}

	const friendDoc = await Mongo.getCollection("friends").findOne({ uid: owner, frienduid: requestor });
	if (!friendDoc) {

		const pendingDoc = await Mongo.getCollection("pendingFriendRequests").findOne({
			$or: [
				{ sender: owner, receiver: requestor },
				{ sender: requestor, receiver: owner },
			],
		});

		if (pendingDoc) {
			friendLevelLRU.set(owner + requestor, FriendLevel.Pending);
			return FriendLevel.Pending;
		}

		friendLevelLRU.set(owner + requestor, 0);
		return FriendLevel.None;
	}

	let friendLevel = FriendLevel.Friends;
	if (friendDoc.trusted) {
		friendLevel = FriendLevel.Friends | FriendLevel.Trusted;
	}

	friendLevelLRU.set(owner + requestor, friendLevel);
	return friendLevel;
};

export const canSeeMembers = async (owner: string, requestor: string): Promise<boolean> => {

	const seeMembers = seeMembersLRU.get(owner + requestor);
	if (seeMembers) {
		return seeMembers;
	}

	const friendDoc = await Mongo.getCollection("friends").findOne({ uid: owner, frienduid: requestor });
	if (!friendDoc) {
		seeMembersLRU.set(owner + requestor, false);
		return false
	}

	friendLevelLRU.set(owner + requestor, friendDoc.seeMembers);
	return friendDoc.seeMembers;
};

export const isPendingFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel === FriendLevel.Pending);
export const isFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel === FriendLevel.Friends) || !!(friendLevel === FriendLevel.Trusted);
export const isTrustedFriend = (friendLevel: FriendLevel): boolean => !!(friendLevel === FriendLevel.Trusted);

export const canAccessDocument = async (requestor: string, owner: string, privateDoc: boolean, preventTrusted: boolean): Promise<boolean> => {
	const friendLevel = await getFriendLevel(owner, requestor);
	if (privateDoc === true) {
		const trustedFriend: boolean = isTrustedFriend(friendLevel);

		// Trusted and not prevent trusted.. give access
		if (trustedFriend && !preventTrusted) {
			return true;
		}

		// Prevent trusted? Don't allow at all
		// Not a trusted friend? Don't allow either
		return false;
	}
	return !!(friendLevel === FriendLevel.Friends) || !!(friendLevel === FriendLevel.Trusted);
}