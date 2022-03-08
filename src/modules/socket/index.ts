import WebSocket from "ws";
import http from "http";

import * as Mongo from "../mongo";
import * as DatabaseAccess from "../../security";

import { transformResultForClientRead } from "../../util";

import Connection from './connection';
import crypto from "crypto";
import { ChangeStream } from "mongodb";

export enum OperationType {
	Read,
	Add,
	Update,
	Delete
}

export interface ChangeEventNative {
	uid: string,
	documentId: string,
	collection: string,
	operationType: OperationType
}

const listenCollections = ["members", "frontStatuses", "notes", "polls", "automatedTimers", "repeatedTimers", "frontHistory", "comments", "groups",]

let _wss: WebSocket.Server | null = null;
const connections = new Map<string, Connection>();
const listenStreams: ChangeStream[] = []

export const onConnectionDestroyed = (uniqueId: string) => connections.delete(uniqueId)

export const init = (server: http.Server) => {
	_wss = new WebSocket.Server({
		server, path: '/v1/socket', perMessageDeflate: {
			zlibDeflateOptions: {
				chunkSize: 1024,
				memLevel: 7,
				level: 3
			},
			zlibInflateOptions: {
				chunkSize: 10 * 1024
			},
			clientNoContextTakeover: true,
			serverNoContextTakeover: true,
			serverMaxWindowBits: 15,
			concurrencyLimit: 10,
			threshold: 100
		}
	});
	_wss.on("connection", (ws) => {
		const uniqueId = crypto.randomBytes(64).toString("base64")
		ws?.on('close', () => connections.delete(uniqueId));

		ws.send("{}")
		connections.set(uniqueId, new Connection(ws, ""));
	});

	if (process.env.LOCALEVENTS === "true") {
		listenCollections.forEach((collection) => {
			const changeStream = Mongo.getCollection(collection).watch([], { fullDocument: "updateLookup" });
			changeStream.on("change", next => {
				dispatch(next)
			});
			listenStreams.push()
		})
	}

};

const stringToOperationType = (type: string): OperationType => {
	if (type === "insert") {
		return OperationType.Add;
	}

	if (type === "update") {
		return OperationType.Update;
	}

	if (type === "delete") {
		return OperationType.Delete;
	}

	return OperationType.Add;
}

const operationTypeToString = (type: OperationType): string => {
	if (type === OperationType.Add) {
		return "insert";
	}

	if (type === OperationType.Update) {
		return "update";
	}

	if (type === OperationType.Delete) {
		return "delete";
	}

	return "insert";
}

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

	if (!document) {
		return;
	}

	const innerEventData: ChangeEventNative = {
		documentId: event.fullDocument._id, operationType: stringToOperationType(event.operationType),
		uid: event.fullDocument.uid,
		collection: event.ns.coll
	}

	const owner = document.uid;
	if (!DatabaseAccess.friendReadCollections.includes(event.ns.coll))
		return dispatchInner(owner, innerEventData);

	// Disabled for now, we would need to handle things differently on the SDK side, right now updates
	// Are expected self-owned and we don't send uid alongside it. It would show friend members
	// in your own members and cause more concern than it's worth at the moment. If SDK is updated
	// and we can make this a needed-only thing (emitting to all friends at all times is also quite bandwidth intensive when it's not needed)
	// Then we can readd it.
	/*
	const friends = await Mongo.getCollection("friends").find({ uid: owner }).toArray();
	const trustedFriends = friends.filter(f => f.trusted);

	if (event.operationType == "delete")
		friends.forEach(f => dispatchInner(f, innerEventData));

	if (document.private) {
		if (!document.preventTrusted)
			trustedFriends.forEach(tf => dispatchInner(tf, innerEventData));
	}
	else
		friends.forEach(f => dispatchInner(f, innerEventData));
		*/


	dispatchInner(owner, innerEventData);
}

export const dispatchDelete = async (event: ChangeEventNative) => {
	const result = { operationType: "delete", id: event.documentId, content: {} };
	const payload = { msg: "update", target: event.collection, results: [result] };

	for (const conn of getUserConnections(event.uid)) {
		conn.send(payload);
	}
}

async function dispatchInner(uid: any, event: ChangeEventNative) {

	let result = {};
	if (event.operationType === OperationType.Delete) {
		result = { operationType: "delete", id: event.documentId };
	} else {
		const document = await Mongo.getCollection(event.collection).findOne({ _id: Mongo.parseId(event.documentId) });
		result = { operationType: operationTypeToString(event.operationType), ...transformResultForClientRead(document, event.uid) };
	}

	const payload = { msg: "update", target: event.collection, results: [result] };


	for (const conn of getUserConnections(uid)) {
		conn.send(payload);
	}
}

const logCurrentConnection = () => {
	console.log("Current socket connections:" + _wss?.clients.size.toString());
	setTimeout(logCurrentConnection, 10000);
};

logCurrentConnection();
