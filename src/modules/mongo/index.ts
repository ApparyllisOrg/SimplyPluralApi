import * as MongoDb from "mongodb";
import { ObjectId } from "mongodb";
import { logger } from "../logger";

import { documentObject, queryObject } from "./baseTypes";

const url = process.env.DATABASE_URI;
const dbName = "SimplyPlural";

const _client = new MongoDb.MongoClient(url!, { poolSize: 1000, useUnifiedTopology: true });
_client.on('close', (...args: any) => {
	// todo: kill socket connections, shutdown http server, exit
	// or just die, that works too
	console.log(args);
});

// utils
const _db = _client.db(dbName);

export const db = () => _db;
export const getRawDb = () => _db;
export const getCollection = (target: string) => _db.collection(target);
export const isLive = () => _client.isConnected();
export const parseId = (id: string): string | MongoDb.ObjectId => {
	if (id.match(/^[0-9a-fA-F]{24}$/))
		return new MongoDb.ObjectId(id);

	return id;
}

// operations

db.getDocument = async (documentId: string, owningId: string, collection: string): Promise<documentObject> =>
	await db().collection(collection).findOne({ uid: owningId, _id: parseId(documentId) });

db.findDocument = async (collection: string, query: any): Promise<documentObject> =>
	await db().collection(collection).findOne(query);

db.getManyDocuments = (documentIds: string[], owningId: string, collection: string) => {
	const convertedQuery: (string | ObjectId)[] = [];
	documentIds.forEach((element: string) => {
		convertedQuery.push(parseId(element));
	});

	return db().collection(collection).find({ uid: owningId, _id: { $in: convertedQuery } });
}

db.getOne = (collection: string, query: queryObject, owningId: string) => {
	// I have no idea what this code is supposed to do
	const useQuery = query;
	if (!query.uid) {
		query.uid = owningId;
	}
	return db().collection(collection).findOne(useQuery);
}

db.getMultiple = (query: queryObject, owningId: string, collection: string) => {
	const useQuery = query;
	if (!query.uid) {
		query.uid = owningId;
	}
	return db().collection(collection).find(useQuery);
}

db.add = (collection: string, obj: documentObject) =>
	db().collection(collection).insertOne(obj);

db.update = async (documentId: string, owningId: string, collection: string, obj: documentObject) => {
	return await db().collection(collection).updateOne({ uid: owningId, _id: parseId(documentId) }, { $set: obj });
}

db.updateOne = async (documentId: string, owningId: string, collection: string, obj: documentObject) => {
	return await db().collection(collection).updateOne({ uid: owningId, _id: parseId(documentId) }, { $set: obj });
}


db.delete = (documentId: string, owningId: string, collection: string) =>
	db().collection(collection).deleteOne({ uid: owningId, _id: parseId(documentId) });

db.deleteMatching = (owningId: string, collection: string, query: any) => {
	const queryObj = query;
	if (!queryObj.uid) {
		queryObj.uid = owningId;
	}
	db().collection(collection).deleteMany(queryObj);
}


// init

const wait = (time: number): Promise<void> =>
	new Promise<void>((res) => setTimeout(res, time));

export const init = async (): Promise<void> => {
	logger.info(`attempt to connect to db: ${url}`);
	await _client.connect();
	const success = isLive();

	if (success) {
		logger.info("`setup db connection");
		return;
	}

	logger.warn("`failed to setup db connection! trying again...");
	await wait(1000);
	await init();
};
