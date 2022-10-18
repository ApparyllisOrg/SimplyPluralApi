import dotenv from "dotenv";
dotenv.config();

import { startCollectingUsage } from "./modules/usage";
import admin, { ServiceAccount } from "firebase-admin";
import * as fs from 'fs';
import { initializeServer, startServer } from "./modules/server";
import { cpus } from "os";
import cluster from "cluster";


if (process.env.DEVELOPMENT) {
	process.on('uncaughtException', console.error);
	process.on('unhandledRejection', console.error);
}

const accJson = JSON.parse(fs.readFileSync("./spGoogle.json").toString());
const acc: ServiceAccount = {}
acc.projectId = accJson.project_id
acc.privateKey = accJson.private_key;
acc.clientEmail = accJson.client_email;

admin.initializeApp({
	credential: admin.credential.cert(acc),
	databaseURL: `https://${accJson.project_id}.firebaseio.com`,
});

startCollectingUsage();

const start = async () => 
{
	const cpuCores = cpus().length;
	let instance = 0;
	while (instance < cpuCores) {
		cluster.fork();
		++instance;
		print("Start worker")
	}

	const app = await initializeServer();
	const server = await startServer(app, process.env.DATABASE_URI ?? "")
}

start();