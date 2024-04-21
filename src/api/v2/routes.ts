import * as core from "express-serve-static-core";
import { isUserAuthenticated } from "../../security/auth";
import { ApiKeyAccessType } from "../../modules/api/keys";
import { generateReport, validateUserReportSchema } from "../v2/user";
import { validateBody } from "../../util/validation";

export const setupV2routes = (app: core.Express) => {
	app.post("/v2/user/generateReport", isUserAuthenticated(ApiKeyAccessType.Read), validateBody(validateUserReportSchema), generateReport);

}