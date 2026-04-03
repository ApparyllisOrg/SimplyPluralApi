import dotenv from "dotenv"
dotenv.config()

import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

if (process.env.SENTRY_DSN && process.env.SENTRY_SAMPLE_RATE) {
	try {
		const sampleRate = Number(process.env.SENTRY_SAMPLE_RATE)
		Sentry.init({ dsn: process.env.SENTRY_DSN, integrations: [nodeProfilingIntegration()], tracesSampleRate: sampleRate, profilesSampleRate: sampleRate })
	} catch (e) {
		console.log("Failed to init Sentry, running without.")
	}
}

import { startCollectingUsage } from "./modules/usage"
import admin, { ServiceAccount } from "firebase-admin"
import { initializeServer, startServer } from "./modules/server"


if (process.env.DEVELOPMENT === "true") {
	console.log("Development mode")
	process.on("uncaughtException", console.error)
	process.on("unhandledRejection", console.error)
}

const accJson = JSON.parse(process.env.SPGOOGLE!)
const acc: ServiceAccount = {}
acc.projectId = accJson.project_id
acc.privateKey = accJson.private_key
acc.clientEmail = accJson.client_email

admin.initializeApp({
	credential: admin.credential.cert(acc),
	databaseURL: `https://${accJson.project_id}.firebaseio.com`,
})

startCollectingUsage()

const start = async () => {
	console.log(`Spawned API instance ${process.env.NODE_APP_INSTANCE}`)
	const app = await initializeServer()
	const _server = await startServer(app, process.env.DATABASE_URI ?? "")
}

start()
