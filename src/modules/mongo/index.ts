import * as MongoDb from "mongodb";
import { ObjectId } from "mongodb";
import { logger } from "../logger";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URI;
const dbName = "SimplyPlural";

// init
console.log("Connecting Mongodb to: " + url)

const _client = new MongoDb.MongoClient(url!, { poolSize: 1000, useUnifiedTopology: true });
_client.on("close", (...args: any) => {
	console.log(args);
});

// utils
let _db: MongoDb.Db | undefined = undefined;

export const db = () => _db;
export const getCollection = (target: string): MongoDb.Collection<any> => _db!.collection(target);
export const isLive = () => _client && _client.isConnected();
export const parseId = (id: string): string | MongoDb.ObjectId => {
	if (id.match(/^[0-9a-fA-F]{24}$/)) {
		if (ObjectId.isValid(id)) {
			return new MongoDb.ObjectId(id);
		}
	}

	return id;
};

// init
const wait = (time: number): Promise<void> =>
	new Promise<void>((res) => setTimeout(res, time));

export const init = async (retry: boolean): Promise<void> => {
	logger.info(`attempt to connect to db: ${url}`);
	console.log(`attempt to connect to db: ${url}`)
	await _client.connect().catch((reason) => console.log(reason)).then((newDb: void | MongoDb.MongoClient) => { _db = newDb?.db(dbName) ?? undefined });
	const success = isLive();

	if (success) {
		logger.info("setup db connection");
		console.log("setup db connection")
		return;
	}

	if (retry) {
		logger.warn("`failed to setup db connection! trying again...");
		console.log("failed to setup db connection! trying again...")
		await wait(1000);
		await init(retry);
	}
};
