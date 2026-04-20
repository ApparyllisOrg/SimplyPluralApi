import dotenv from "dotenv"
dotenv.config()

import { config } from "./modules/config"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { startCollectingUsage } from "./modules/usage"
import admin, { ServiceAccount } from "firebase-admin"
import { initializeServer, startServer } from "./modules/server"

const cfg = config()

if (cfg.sentry) {
	try {
		Sentry.init({ dsn: cfg.sentry.dsn, integrations: [nodeProfilingIntegration()], tracesSampleRate: cfg.sentry.sampleRate, profilesSampleRate: cfg.sentry.sampleRate })
	} catch (e) {
		console.log("Failed to init Sentry, running without.")
	}
}

if (cfg.development) {
	console.log("Development mode")
	process.on("uncaughtException", console.error)
	process.on("unhandledRejection", console.error)
}

if (cfg.firebase) {
	const accJson = JSON.parse(cfg.firebase.serviceAccount)
	const acc: ServiceAccount = {}
	acc.projectId = accJson.project_id
	acc.privateKey = accJson.private_key
	acc.clientEmail = accJson.client_email

	admin.initializeApp({
		credential: admin.credential.cert(acc),
		databaseURL: `https://${accJson.project_id}.firebaseio.com`,
	})
}

startCollectingUsage()

const start = async () => {
	console.log(`Spawned API instance ${process.env.NODE_APP_INSTANCE}`)
	const app = await initializeServer()
	const _server = await startServer(app, config().database.uri)
}

start()
