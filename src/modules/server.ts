import { startMailTransport } from "../modules/mail";
import { startPkController } from "../modules/integrations/pk/controller";
import { logger } from "../modules/logger";
import * as socket from "../modules/socket";
import * as Mongo from "../modules/mongo";
import * as Sentry from "@sentry/node";
import { setupV1routes } from "../api/v1/routes";
import setupBaseRoutes from "../api/routes";
import helmet from "helmet";
import http from "http";
import prom from "express-prom-bundle"
import promclient from "prom-client"
import express from "express";
import { validateOperationTime, validatePostId } from "../util/validation";
import { NextFunction, Request, Response } from "express-serve-static-core";
import cors from "cors";

export const initializeServer = async () => {
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

	app.use(express.json({ limit: "3mb" }));

	if (process.env.DEVELOPMENT && process.env.UNITTEST !== "true") {
		const logRequest = async (req: Request, _res: Response, next: NextFunction) => {
			console.log(`${req.method} => ${req.url}`)
			next()
		}

		app.use(logRequest)
	} 

	const collectDefaultMetrics = promclient.collectDefaultMetrics;
	const Registry = promclient.Registry;
	const register = new Registry();
	collectDefaultMetrics({ register });

	const metricsMiddleware = prom({includeMethod: true, includePath: true, includeStatusCode: true, normalizePath: (req, opts) => {
		return req.route?.path ?? "NULL";
	}});

	app.use(metricsMiddleware);

	// Verify the operation time of this request
	app.use(validateOperationTime);

	setupV1routes(app);
	setupBaseRoutes(app);

	// Has to be *after* all controllers
	app.use(Sentry.Handlers.errorHandler());

	return app;
}

export const startServer = async (app : any, mongourl: string) => {
	const server = http.createServer({}, app);

	// make sure MongoDB is initialized before anything else runs
	await Mongo.init(true,mongourl);

	socket.init(server);

	const port = process.env.PORT ?? 3000;
	server.listen(port, () => logger.info(`Initiating Apparyllis API at :${port}`));
	console.log(`Started server on port ${port.toString()}`)

	startPkController();
	startMailTransport();

	return server;
}

export const stopServer = async (server: http.Server) => 
{
	server.close();
}