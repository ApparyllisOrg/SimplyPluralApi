import * as MongoDb from "mongodb";
import { ObjectId } from "mongodb";
import { logger } from "../logger";
import dotenv from "dotenv";
import * as events from "../events/eventController";
dotenv.config();

const dbName = process.env.DBNAME;

// utils
let _db: MongoDb.Db | undefined = undefined;

export const db = () => _db;
export const getCollection = (target: string): MongoDb.Collection<any> => _db!.collection(target);
export const parseId = (id: string): string | MongoDb.ObjectId => {
	if (typeof id === "string" && id.match(/^[0-9a-fA-F]{24}$/) && ObjectId.isValid(id)) {
		return new MongoDb.ObjectId(id);
	}
	return id;
};

// init
const wait = (time: number): Promise<void> => new Promise<void>((res) => setTimeout(res, time));

export const init = async (retry: boolean, url: string): Promise<void> => {
	// init

	console.log("Connecting Mongodb to");
	const _client = new MongoDb.MongoClient(url ?? "", { maxPoolSize: 1000, minPoolSize: 100 });
	_client.on("close", (...args: any) => {
		console.log(args);
	});

	console.log(`attempt to connect to db`);

	try {
		await _client.connect().then((newDb: void | MongoDb.MongoClient) => {
			_db = newDb?.db(dbName) ?? undefined;
		});
		logger.info("setup db connection");
		console.log("setup db connection");
		events.init();
		return;
	} catch (e: any) {
		console.log(e.toString());
		if (retry) {
			logger.warn("`failed to setup db connection! trying again...");
			console.log("failed to setup db connection! trying again...");
			await wait(1000);
			await init(retry, url);
		}
	}
};
