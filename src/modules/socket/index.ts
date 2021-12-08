import WebSocket from "ws";
import http from "http";

import * as Mongo from "../mongo";
import * as DatabaseAccess from "../../security";

import { transformResultForClientRead } from "../../util";
import { logger } from "../logger";

import Connection from './connection';
import crypto from "crypto";

export enum OperationType {
	Read,
	Add,
	Update,
	Delete
}

export interface ChangeEvent {
	uid: string,
	documentId: string,
	collection: string,
	operationType: OperationType
}

let _wss: WebSocket.Server | null = null;
const connections = new Map<string, Connection>();

export const init = (server: http.Server) => {
	_wss = new WebSocket.Server({ server, path: '/api/v1/socket' });
	_wss.on("connection", (ws) => {
		const uniqueId = crypto.randomUUID();
		connections.set(uniqueId, new Connection(ws, () => connections.delete(uniqueId)));
	});
};

export const getUserConnections = (uid: string) =>
	[...connections.values()].filter(conn => conn.uid === uid);

export async function notify(uid: string, title: string, message: string) {
	const payload = { msg: "notification", title, message };

	for (const conn of getUserConnections(uid)) {
		conn.send(payload);
	}
}

export async function dispatch(event: any) {
	const document = event.fullDocument;
	const owner = document.uid;
	if (!DatabaseAccess.friendReadCollections.includes(event.ns.coll))
		return dispatchInner(owner, event);

	const friends = await Mongo.db().collection("friends").find({ uid: owner }).toArray();
	const trustedFriends = friends.filter(f => f.trusted);

	if (event.operationType == "delete")
		friends.forEach(f => dispatchInner(f, event));

	if (document.private) {
		if (!document.preventTrusted)
			trustedFriends.forEach(tf => dispatchInner(tf, event));
	}
	else
		friends.forEach(f => dispatchInner(f, event));

	dispatchInner(owner, event);
}

async function dispatchInner(uid: any, event: ChangeEvent) {
	let result = {};
	if (event.operationType === OperationType.Delete) {
		result = { operationType: "delete", id: event.documentId };
	} else {
		const document = await Mongo.getCollection(event.collection).findOne({ _id: Mongo.parseId(event.documentId) });
		if (DatabaseAccess.friendReadCollections.indexOf(event.collection) < 0) {
			return;
		}
		result = { operationType: event.operationType, ...transformResultForClientRead(document, event.uid) };
	}

	const payload = { msg: "update", target: event.collection, results: [result] };

	for (const conn of getUserConnections(uid)) {
		conn.send(payload);
	}
}

const logCurrentConnection = () => {
	logger.info("Current socket connections:" + _wss?.clients.size.toString());
	setTimeout(logCurrentConnection, 1000);
};

logCurrentConnection();
