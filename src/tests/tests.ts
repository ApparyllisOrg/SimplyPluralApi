import mongoUnit from "mongo-unit"
import { initializeServer, startServer, stopServer } from "../modules/server";
import dotenv from "dotenv";
import { assignApiKey, generateNewApiKey } from "../modules/api/keys";
import { setTestToken } from "./utils";

dotenv.config();

process.env.UNITTEST = "true";

mongoUnit.start({port: 21079}).then(async () => {
	console.log('fake mongo is started: ', mongoUnit.getUrl())
	process.env['DATABASE_URI']= mongoUnit.getUrl() 
	mongoUnit.load({})

	const app = await initializeServer();
	const server = await startServer(app, mongoUnit.getUrl())

	// Generate and assign a test token
	const token = await generateNewApiKey();
	const success = await assignApiKey(true, true, true, token, "foo");

	setTestToken(token)
	console.log("Chosen token is %s", token)

	// Start the tests
  	run()
})
