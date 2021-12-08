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
import { validateGetQuery } from "./util/validation";

const app = express();

dotenv.config();


if (!process.env.DEVELOPMENT) {
	Sentry.init({ dsn: process.env.SENTRY_DSN });
	app.use(Sentry.Handlers.requestHandler());
	app.use(helmet());
}


admin.initializeApp({
	credential: admin.credential.cert(fs.readFileSync("./spGoogle.json") as ServiceAccount),
	databaseURL: "https://frontime-7aace.firebaseio.com",
});

startCollectingUsage();

app.use(express.json({ limit: "15mb" }));
// Verify get query
app.use(validateGetQuery);
setupV1routes(app);
app.use(onUsage);

// Has to be *after* all controllers
app.use(Sentry.Handlers.errorHandler());

const server = http.createServer({}, app);


// final setup needs to be completed async
(async () => {

	// make sure MongoDB is initialized before anything else runs
	await Mongo.init();

	socket.init(server);

	const port = process.env.PORT ?? 3000;
	server.listen(port, () => logger.info(`Initiating Apparyllis API at :${port}`));

})();
