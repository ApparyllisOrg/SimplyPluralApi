import * as MongoDb from "mongodb";
import { ObjectId } from "mongodb";
import { logger } from "../logger";
import dotenv from "dotenv";
import * as events from "../events/eventController"
dotenv.config();

const url: string | undefined = process.env.DATABASE_URI;
const dbName = process.env.DBNAME;

// init
console.log("Connecting Mongodb to: " + url)

const _client = new MongoDb.MongoClient(url ?? "", { maxPoolSize: 1000, minPoolSize: 100 });
_client.on("close", (...args: any) => {
	console.log(args);
});

// utils
let _db: MongoDb.Db | undefined = undefined;

export const db = () => _db;
export const getCollection = (target: string): MongoDb.Collection<any> => _db!.collection(target);
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

export const init = async (retry: boolean): Promise<void> => {
	logger.info(`attempt to connect to db: ${url}`);
	console.log(`attempt to connect to db: ${url}`)
	try {
		await _client.connect().then((newDb: void | MongoDb.MongoClient) => { _db = newDb?.db(dbName) ?? undefined });
		logger.info("setup db connection");
		console.log("setup db connection")
		events.init();
		return;
	} 
	catch (e: any)
	{
		console.log(e.toString())
		if (retry) {
		logger.warn("`failed to setup db connection! trying again...");
		console.log("failed to setup db connection! trying again...")
		await wait(1000);
		await init(retry);
		}
	}
};
