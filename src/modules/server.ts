import { startMailTransport } from "../modules/mail"
import { startPkController } from "../modules/integrations/pk/controller"
import { logger } from "../modules/logger"
import * as socket from "../modules/socket"
import * as Mongo from "../modules/mongo"
import * as Sentry from "@sentry/node"
import { setupV1routes } from "../api/v1/routes"
import setupBaseRoutes from "../api/routes"
import helmet from "helmet"
import http from "http"
import prom from "express-prom-bundle"
import promclient from "prom-client"
import express from "express"
import { validateOperationTime } from "../util/validation"
import { NextFunction, Request, Response } from "express-serve-static-core"
import cors from "cors"
import cluster from "cluster"
import { initializeStripe } from "../api/v1/subscriptions/subscriptions.core"
import { loadTemplates } from "./mail/mailTemplates"
import { setupV2routes } from "../api/v2/routes"
import { initStorageController, storageController } from "./storage/storageController"
import { StorageTargetS3 } from "./storage/storageTargetS3"
import { StorageTargetMinIO } from "./storage/storageTargetMinIO"
import { config } from "./config"

export const initializeServer = async () => {
	const app = express()
	const cfg = config()

	if (cfg.development) {
		app.use(cors())
	}

	if (!cfg.development) {
		app.use(helmet())
	}

	initializeStripe(app)

	await loadTemplates()

	app.use(express.json({ limit: "3mb" }))

	if (cfg.development && !cfg.unitTest) {
		const logRequest = async (req: Request, res: Response, next: NextFunction) => {
			console.log(`[START] ${req.method} => ${req.url}`)

			const tNowStart = Date.now()

			res.on("finish", () => {
				const tNowEnd = Date.now()
				const diff = (tNowEnd - tNowStart) / 1000.0
				console.log(`[END] ${req.method} => ${req.url} => [${res.statusCode}] => ${diff}s`)
			})

			res.on("error", (err: Error) => {
				const tNowEnd = Date.now()
				const diff = (tNowEnd - tNowStart) / 1000.0
				console.log(`[ERR] ${req.method} => ${req.url} => ${err.message} => ${diff}s`)
			})

			next()
		}

		app.use(logRequest)
	}

	const collectDefaultMetrics = promclient.collectDefaultMetrics
	const Registry = promclient.Registry
	const register = new Registry()
	collectDefaultMetrics({ register })

	const metricsMiddleware = prom({
		includeMethod: true,
		includePath: true,
		includeStatusCode: true,
		normalizePath: (req, _opts) => {
			return req.route?.path ?? "NULL"
		},
	})

	app.use(metricsMiddleware)

	const storageCfg = cfg.storage
	if (storageCfg) {
		initStorageController()

		const primaryS3Target = new StorageTargetS3(storageCfg.primaryS3.bucket)
		primaryS3Target.init(storageCfg.primaryS3.endpoint, storageCfg.primaryS3.region, storageCfg.primaryS3.accessKey, storageCfg.primaryS3.accessSecret)

		storageController?.registerStorageTarget(primaryS3Target)
		storageController?.setPrimaryTarget(primaryS3Target)

		if (storageCfg.legacyS3) {
			const legacyS3Target = new StorageTargetS3(storageCfg.legacyS3.bucket)
			legacyS3Target.init(storageCfg.legacyS3.endpoint, storageCfg.legacyS3.region, storageCfg.legacyS3.accessKey, storageCfg.legacyS3.accessSecret)

			storageController?.registerStorageTarget(legacyS3Target)
		}

		if (storageCfg.legacyMinIO) {
			const legacyMinIOTarget = new StorageTargetMinIO(storageCfg.legacyMinIO.bucket)
			legacyMinIOTarget.init(storageCfg.legacyMinIO.endpoint, storageCfg.legacyMinIO.port, storageCfg.legacyMinIO.accessKey, storageCfg.legacyMinIO.accessSecret)

			storageController?.registerStorageTarget(legacyMinIOTarget)
		}
	}

	// Verify the operation time of this request
	app.use(validateOperationTime)

	setupV1routes(app)
	setupV2routes(app)
	setupBaseRoutes(app)

	// Has to be *after* all controllers
	Sentry.setupExpressErrorHandler(app)

	console.log(`Starting server as ${cluster.isPrimary ? "Primary" : "Worker"}`)

	return app
}

export const startServer = async (app: any, mongourl: string) => {
	const server = http.createServer({}, app)

	// make sure MongoDB is initialized before anything else runs
	await Mongo.init(true, mongourl)

	await socket.init(server)

	const port = config().server.port
	server.listen(port, () => logger.info(`Initiating API at :${port}`))
	console.log(`Started server on port ${port.toString()}`)

	startPkController()
	startMailTransport()

	return server
}

export const stopServer = async (server: http.Server) => {
	server.close()
}
