import * as Mongo from "./modules/mongo";
import * as Sentry from "@sentry/node";
import { logger } from "./modules/logger";

import * as socket from "./modules/socket";
import * as plural from "./api/plural/v1/routes";
import * as being from "./api/being/v1/routes";
import setupBaseRoutes from "./api/routes";
import { startCollectingUsage } from "./modules/usage";

import admin, { ServiceAccount } from "firebase-admin";
import * as fs from 'fs';

import helmet from "helmet";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import { validateGetParams, validateOperationTime } from "./util/validation";
import { startPkController } from "./modules/integrations/pk/controller";
import { NextFunction, Request, Response } from "express-serve-static-core";
import { startMailTransport } from "./modules/mail";
import cors from "cors";

if (process.env.DEVELOPMENT) {
	process.on('uncaughtException', console.error);
	process.on('unhandledRejection', console.error);
}

const app = express();

if (process.env.DEVELOPMENT) {
	app.use(cors())
}

dotenv.config();

if (!process.env.DEVELOPMENT) {
	if (process.env.SENTRY_DSN) {
		Sentry.init({ dsn: process.env.SENTRY_DSN });
	}
	app.use(Sentry.Handlers.requestHandler());
	app.use(helmet());
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
app.use(express.json({ limit: "3mb" }));

if (process.env.DEVELOPMENT) {
	const logRequest = async (req: Request, _res: Response, next: NextFunction) => {
		console.log(`${req.method} => ${req.url}`)
		next()
	}

	app.use(logRequest)
}

// Verify get query
app.use(validateGetParams);
// Verify the operation time of this request
app.use(validateOperationTime);

plural.setupV1routes(app);
being.setupV1routes(app);

setupBaseRoutes(app);

// Has to be *after* all controllers
app.use(Sentry.Handlers.errorHandler());

const server = http.createServer({}, app);
const initializeServer = async () => {

	// make sure MongoDB is initialized before anything else runs
	await Mongo.init(true);

	socket.init(server);

	const port = process.env.PORT ?? 3000;
	server.listen(port, () => logger.info(`Initiating Apparyllis API at :${port}`));

	startPkController();
	startMailTransport();
}

initializeServer();