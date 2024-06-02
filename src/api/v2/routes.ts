import * as core from "express-serve-static-core";
import { isUserAuthenticated } from "../../security/auth";
import { ApiKeyAccessType } from "../../modules/api/keys";
import { generateReport, validateUserReportSchema } from "../v2/user";
import { validateBody, validateId, validateQuery } from "../../util/validation";
import { add, validatePostGroupSchema } from "../v2/group";
import { AddFriend, RespondToFriendRequest, validatAddFrienqRequestV2Schema, validateRespondToFrienqRequestQuerySchema } from "../v1/friendActions";

export const setupV2routes = (app: core.Express) => {

	// Groups
	app.post("/v2/group/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(validatePostGroupSchema), validateId, add);

	// Friends
	app.post("/v2/friends/request/add/:usernameOrId", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(validatAddFrienqRequestV2Schema), AddFriend);

	// User
	app.post("/v2/user/generateReport", isUserAuthenticated(ApiKeyAccessType.Read), validateBody(validateUserReportSchema), generateReport);

}
