// Usage module for the Apparyllis API. Keep track of usage for the API to keep fair use in check.
// If we notice that a particular user is calling the API a lot more than others we can react to it using
// the usage stats, where otherwise we wouldn't know who actually did what on the API, other than an IP which is not really useful, especially when behind a VPN.
// The stats aren't meant to keep track of normal usage, only there for abuse of API.

// TODO #20 Automatically delete usage older than 14 days
// TODO #19:Log usage per day

// todo: all of this should be in a global middleware, really
import { Request, Response, NextFunction } from "express";
import * as Mongo from "./mongo";

const collectedUsage: Map<string, Map<string, number>> = new Map<string, Map<string, number>>();

export const startCollectingUsage = () => {
	collectUsage();
}

const collectUsage = () => {
	collectedUsage.forEach((value, key) => {
		const updateObj: Map<string, unknown> = new Map<string, unknown>();

		value.forEach((count, method) => {
			updateObj.set(method, { $add: count });
		});

		Mongo.db().collection("usage").updateOne({ uid: key }, updateObj);
	});

	collectedUsage.clear();

	setTimeout(collectUsage, 1000 * 60);
}

export const onUsage = (req: Request, res: Response, next: NextFunction) => {
	logUserUsage(res.locals.uid, req.route);
	next();
}

const logUserUsage = (uid: string, action: string) => {
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
		}
		else {
			userUsage.set(action, 1);
		}
	}
}
