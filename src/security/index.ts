import * as Mongo from "../modules/mongo";
import LRU from "lru-cache";
import { getCollection } from "../modules/mongo";
import moment from "moment";
import { auth } from "firebase-admin";
import { Request } from "express";

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
	Trusted = 3,
}

const friendLevelLRU = new LRU<string, FriendLevel>({ max: 10000, ttl: 1000 * 5 });
const seeMembersLRU = new LRU<string, boolean>({ max: 10000, ttl: 1000 * 5 });

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
		return false;
	}

	seeMembersLRU.set(owner + requestor, friendDoc.seeMembers);
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
		// eslint-disable-next-line sonarjs/prefer-single-boolean-return
		if (trustedFriend && !preventTrusted) {
			return true;
		}

		// Prevent trusted? Don't allow at all
		// Not a trusted friend? Don't allow either
		return false;
	}
	return !!(friendLevel === FriendLevel.Friends) || !!(friendLevel === FriendLevel.Trusted);
};

export const logSecurityUserEvent = async (uid: string, action: string, request: Request) => {
	await getCollection("securityLogs").insertOne({ uid: uid, at: moment.now(), action, ip: request.header("x-forwarded-for") ?? request.ip });
};

export const isUserSuspended = async (uid: string) => {
	const result = await getCollection("accounts").findOne({ uid });
	return result && result.suspended === true;
};

export const isUserVerified = async (uid: string) => {
	const result = await getCollection("accounts").findOne({ uid });
	if (result) {
		return result.verified === true || result.oAuth2 === true;
	} else {
		const firebaseUser = await auth().getUser(uid).catch((r) => undefined);

		if (firebaseUser) {
			// oAuth2 is always verified
			if (firebaseUser.emailVerified === true || firebaseUser.providerData.length > 0) {
				return true;
			}
		}
	}

	return false;
};
