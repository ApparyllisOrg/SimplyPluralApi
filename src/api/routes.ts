import * as core from 'express-serve-static-core';

export default function setupBaseRoutes(app: core.Express) {
    app.get("/", (_, res) => res.sendStatus(200));
}