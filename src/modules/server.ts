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
import { setupCat } from "../api/v1/subscriptions/subscriptions.core"
import { loadTemplates } from "./mail/mailTemplates"
import { setupV2routes } from "../api/v2/routes"
import { initStorageController, storageController } from "./storage/storageController"
import { StorageTargetS3 } from "./storage/storageTargetS3"
import assert from "assert"
import { StorageTargetMinIO } from "./storage/storageTargetMinIO"

export const initializeServer = async () => {
	const app = express()

	if (process.env.DEVELOPMENT) {
		app.use(cors())
	}

	if (!process.env.DEVELOPMENT) {
		app.use(helmet())
	}

	setupCat(app)

	await loadTemplates()

	app.use(express.json({ limit: "3mb" }))

	if (process.env.DEVELOPMENT && process.env.UNITTEST !== "true") {
		const logRequest = async (req: Request, _res: Response, next: NextFunction) => {
			console.log(`${req.method} => ${req.url}`)
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

	if (process.env.WITH_STORAGE === "true") {
		initStorageController()

		assert(process.env.PRIMARY_S3_BUCKET, "PRIMARY_S3_BUCKET is required")
		assert(process.env.PRIMARY_S3_ENDPOINT, "PRIMARY_S3_ENDPOINT is required")
		assert(process.env.PRIMARY_S3_REGION, "PRIMARY_S3_REGION is required")
		assert(process.env.PRIMARY_S3_ACCESS_KEY, "PRIMARY_S3_ACCESS_KEY is required")
		assert(process.env.PRIMARY_S3_ACCESS_SECRET, "PRIMARY_S3_ACCESS_SECRET is required")

		const primaryS3Target = new StorageTargetS3(process.env.PRIMARY_S3_BUCKET)
		primaryS3Target.init(process.env.PRIMARY_S3_ENDPOINT, process.env.PRIMARY_S3_REGION, process.env.PRIMARY_S3_ACCESS_KEY, process.env.PRIMARY_S3_ACCESS_SECRET)

		storageController?.registerStorageTarget(primaryS3Target)
		storageController?.setPrimaryTarget(primaryS3Target)

		if (process.env.WITH_LEGACY_S3 === "true") {
			assert(process.env.LEGACY_S3_BUCKET, "LEGACY_S3_BUCKET is required")
			assert(process.env.LEGACY_S3_ENDPOINT, "LEGACY_S3_ENDPOINT is required")
			assert(process.env.LEGACY_S3_REGION, "LEGACY_S3_REGION is required")
			assert(process.env.LEGACY_S3_ACCESS_KEY, "LEGACY_S3_ACCESS_KEY is required")
			assert(process.env.LEGACY_S3_ACCESS_SECRET, "LEGACY_S3_ACCESS_SECRET is required")

			const legacyS3Target = new StorageTargetS3(process.env.LEGACY_S3_BUCKET)
			legacyS3Target.init(process.env.LEGACY_S3_ENDPOINT, process.env.LEGACY_S3_REGION, process.env.LEGACY_S3_ACCESS_KEY, process.env.LEGACY_S3_ACCESS_SECRET)

			storageController?.registerStorageTarget(legacyS3Target)
		}

		if (process.env.WITH_LEGACY_MINIO === "true") {
			assert(process.env.LEGACY_MINIO_BUCKET, "LEGACY_S3_BUCKET is required")
			assert(process.env.LEGACY_MINIO_ENDPOINT, "LEGACY_S3_ENDPOINT is required")
			assert(process.env.LEGACY_MINIO_PORT, "LEGACY_MINIO_PORT is required")

			const legacyMinIOPort = Number(process.env.LEGACY_MINIO_PORT)
			assert(!Number.isNaN(legacyMinIOPort), "LEGACY_MINIO_PORT must be a number")
			assert(legacyMinIOPort >= 1024 && legacyMinIOPort <= 65534, "LEGACY_MINIO_PORT must be between 1024 and 66534")

			assert(process.env.LEGACY_MINIO_ACCESS_KEY, "LEGACY_MINIO_ACCESS_KEY is required")
			assert(process.env.LEGACY_MINIO_ACCESS_SECRET, "LEGACY_MINIO_ACCESS_SECRET is required")

			const legacyMinIOTarget = new StorageTargetMinIO(process.env.LEGACY_MINIO_BUCKET)
			legacyMinIOTarget.init(process.env.LEGACY_MINIO_ENDPOINT, legacyMinIOPort, process.env.LEGACY_MINIO_ACCESS_KEY, process.env.LEGACY_MINIO_ACCESS_SECRET)

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

	const port = process.env.PORT ?? 3000
	server.listen(port, () => logger.info(`Initiating Apparyllis API at :${port}`))
	console.log(`Started server on port ${port.toString()}`)

	startPkController()
	startMailTransport()

	return server
}

export const stopServer = async (server: http.Server) => {
	server.close()
}
