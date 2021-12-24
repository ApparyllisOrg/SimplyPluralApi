import * as Mongo from "./modules/mongo";
import * as Sentry from "@sentry/node";
import { logger } from "./modules/logger";

import * as socket from "./modules/socket";
import { setupV1routes } from "./api/v1/routes";
import { onUsage, startCollectingUsage } from "./modules/usage";

import admin, { ServiceAccount } from "firebase-admin";
import * as fs from 'fs';

import helmet from "helmet";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import { validateGetParams, validateOperationTime } from "./util/validation";
import { startPkController } from "./modules/integrations/pk/controller";

const app = express();

dotenv.config();

if (!process.env.DEVELOPMENT) {
	Sentry.init({ dsn: process.env.SENTRY_DSN });
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
	databaseURL: "https://frontime-7aace.firebaseio.com",
});

startCollectingUsage();

app.use(express.json({ limit: "15mb" }));
// Verify get query
app.use(validateGetParams);
// Verify the operation time of this request
app.use(validateOperationTime);
setupV1routes(app);
app.use(onUsage);

// Has to be *after* all controllers
app.use(Sentry.Handlers.errorHandler());

const server = http.createServer({}, app);

// final setup needs to be completed async
(async () => {

	// make sure MongoDB is initialized before anything else runs
	await Mongo.init(true);

	socket.init(server);

	const port = process.env.PORT ?? 3000;
	server.listen(port, () => logger.info(`Initiating Apparyllis API at :${port}`));

	startPkController();
})();
