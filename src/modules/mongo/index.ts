import * as MongoDb from "mongodb";
import { ObjectId } from "mongodb";
import { logger } from "../logger";
import dotenv from "dotenv";
import * as events from "../events/eventController"
import { SimplyPluralDb, SimplyBeingDb } from "../../util/types";
dotenv.config();

const url: string | undefined = process.env.DATABASE_URI;
const dbName = process.env.DBNAME;

// init
console.log("Connecting Mongodb to: " + url)

const _client = new MongoDb.MongoClient(url ?? "", { poolSize: 1000, useUnifiedTopology: true });
_client.on("close", (...args: any) => {
	console.log(args);
});

// utils
let _pluralDb: MongoDb.Db | undefined = undefined;
let _beingDb: MongoDb.Db | undefined = undefined;

export const db = (database: string) => database === SimplyPluralDb ? _pluralDb : _beingDb;
export const getCollection = (target: string, database: string): MongoDb.Collection<any> => (database === SimplyPluralDb ? _pluralDb : _beingDb)!.collection(target);
export const isLive = () => _client && _client.isConnected();
export const parseId = (id: string): string | MongoDb.ObjectId => {
	if (typeof (id) === "string") {
		if (id.match(/^[0-9a-fA-F]{24}$/)) {
			if (ObjectId.isValid(id)) {
				return new MongoDb.ObjectId(id);
			}
		}
	}
	return id;
};

// init
const wait = (time: number): Promise<void> =>
	new Promise<void>((res) => setTimeout(res, time));

const setupDb = (newDb: void | MongoDb.MongoClient) => {
	_pluralDb = newDb?.db(SimplyPluralDb) ?? undefined
	_beingDb = newDb?.db(SimplyBeingDb) ?? undefined
}

export const init = async (retry: boolean): Promise<void> => {
	logger.info(`attempt to connect to db: ${url}`);
	console.log(`attempt to connect to db: ${url}`)
	await _client.connect().catch((reason) => console.log(reason)).then(setupDb);
	const success = isLive();

	if (success) {
		logger.info("setup db connection");
		console.log("setup db connection")
		events.init();
		return;
	}

	if (retry) {
		logger.warn("`failed to setup db connection! trying again...");
		console.log("failed to setup db connection! trying again...")
		await wait(1000);
		await init(retry);
	}
};
