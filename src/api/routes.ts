import * as core from "express-serve-static-core"
import { serveStorageFile } from "./base/storage"
import { config } from "../modules/config"

export default function setupBaseRoutes(app: core.Express) {
	app.get("/", (_, res) => res.status(200).send())

	if (config().storage?.primaryTarget === "local") {
		app.get("/storage/*", serveStorageFile)
	}
}
