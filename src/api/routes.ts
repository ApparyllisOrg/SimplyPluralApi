import * as core from "express-serve-static-core";

export default function setupBaseRoutes(app: core.Express) {
	app.get("/", (_, res) => res.status(200).send());
}
