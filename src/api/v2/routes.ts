import * as core from "express-serve-static-core";
import { isUserAuthenticated } from "../../security/auth";
import { ApiKeyAccessType } from "../../modules/api/keys";
import { generateReport, validateUserReportSchema } from "../v2/user";
import { validateBody, validateId } from "../../util/validation";
import { add, validatePostGroupSchema } from "../v2/group";

export const setupV2routes = (app: core.Express) => {

	// Groups
	app.post("/v2/group/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(validatePostGroupSchema), validateId, add);

	// User
	app.post("/v2/user/generateReport", isUserAuthenticated(ApiKeyAccessType.Read), validateBody(validateUserReportSchema), generateReport);

}