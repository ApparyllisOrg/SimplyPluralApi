import dotenv from "dotenv";
dotenv.config();

import * as Mongo from "./modules/mongo";
import * as Sentry from "@sentry/node";
import { logger } from "./modules/logger";

import * as socket from "./modules/socket";
import { setupV1routes } from "./api/v1/routes";
import setupBaseRoutes from "./api/routes";
import { startCollectingUsage } from "./modules/usage";

import admin, { ServiceAccount } from "firebase-admin";
import * as fs from 'fs';

import helmet from "helmet";
import http from "http";


import express from "express";
import { validateGetParams, validateOperationTime } from "./util/validation";
import { startPkController } from "./modules/integrations/pk/controller";
import { NextFunction, Request, Response } from "express-serve-static-core";
import { startMailTransport } from "./modules/mail";
import cors from "cors";

import prom from "express-prom-bundle"
import promclient from "prom-client"
import urlparser from "url-value-parser"

if (process.env.DEVELOPMENT) {
	process.on('uncaughtException', console.error);
	process.on('unhandledRejection', console.error);
}
const app = express();

if (process.env.DEVELOPMENT) {
	app.use(cors())
}

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
} else 
{
	const collectDefaultMetrics = promclient.collectDefaultMetrics;
	const Registry = promclient.Registry;
	const register = new Registry();
	collectDefaultMetrics({ register });

	const metricsMiddleware = prom({includeMethod: true, includePath: true, includeStatusCode: true, normalizePath: (req, opts) => {
		let path : string = req.path;

		const queryId = req.params.id ?? "";

		const urlEnding = `/${queryId}`;

		if (path.endsWith(urlEnding))
		{
			path = path.substring(0, path.length - urlEnding.length)
		}

		// Add firebase user id regex
		const parser = new urlparser({extraMasks:[/^[0-9a-zA-Z]{27,35}$/]});
		return parser.replacePathValues(path, '#id');
	}});

	app.use(metricsMiddleware);
}

// Verify get query
app.use(validateGetParams);
// Verify the operation time of this request
app.use(validateOperationTime);

setupV1routes(app);
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