import dotenv from "dotenv"
dotenv.config()

import { initializeServer, startServer } from "../modules/server"
import { assignApiKey, generateNewApiKey } from "../modules/api/keys"
import { getTestUID, setTestToken } from "./utils"

import { MongoMemoryServer } from "mongodb-memory-server"
import { initStorageController, storageController } from "../modules/storage/storageController"
import { StorageTargetNull } from "../modules/storage/storageTargetNull"
import { config } from "../modules/config"

process.env.UNITTEST = "true"
process.env.BASE_URL = "http://localhost:3000"

const setupTest = async () => {
	const mongod = await MongoMemoryServer.create()

	console.log("fake mongo is started: ", mongod.getUri())
	process.env["DATABASE_URI"] = mongod.getUri()

	config()

	const app = await initializeServer()

	initStorageController()

	const nullStorageTarget = new StorageTargetNull()
	nullStorageTarget.init()

	storageController?.registerStorageTarget(nullStorageTarget)
	storageController?.setPrimaryTarget(nullStorageTarget)

	await startServer(app, mongod.getUri())

	// Generate and assign a test token
	const token = await generateNewApiKey()
	await assignApiKey(true, true, true, token, getTestUID())

	setTestToken(token)
	console.log("Chosen token is %s", token)

	after(async function () {
		await mongod.stop()
	})

	// Start the tests
	run()
}

setupTest()
