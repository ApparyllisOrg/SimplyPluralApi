import * as core from "express-serve-static-core"
import { isUserAppJwtAuthenticated, isUserAuthenticated } from "../../security/auth"
import { ApiKeyAccessType } from "../../modules/api/keys"
import { generateReport, validateUserReportSchema } from "../v2/user"
import { validateBody, validateId, validateParamsSchema } from "../../util/validation"
import { add, validatePostGroupSchema } from "../v2/group"
import { AddFriend, validatAddFrienqRequestV2Schema } from "../v1/friendActions"
import { validateStoreAvatarSchema } from "../v1/storage"
import { DeleteContentAvatar, StoreContentAvatar } from "./storage/storage.content"
import { DeleteUserAvatar, StoreUserAvatar } from "./storage/storage.user"
import { validateStoreAvatarParamsSchema } from "./storage/storage.utils"

export const setupV2routes = (app: core.Express) => {
	// Groups
	app.post("/v2/group/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(validatePostGroupSchema), validateId, add)

	// Friends
	app.post("/v2/friends/request/add/:usernameOrId", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(validatAddFrienqRequestV2Schema), AddFriend)

	// Avatar
	app.post("/v2/avatar/user", isUserAppJwtAuthenticated, validateBody(validateStoreAvatarSchema), StoreUserAvatar)
	app.post("/v2/avatar/:type/:id", isUserAppJwtAuthenticated, validateParamsSchema(validateStoreAvatarParamsSchema), validateBody(validateStoreAvatarSchema), StoreContentAvatar)
	app.delete("/v2/avatar/user", isUserAppJwtAuthenticated, DeleteUserAvatar)
	app.delete("/v2/avatar/:type/:id", isUserAppJwtAuthenticated, validateParamsSchema(validateStoreAvatarParamsSchema), DeleteContentAvatar)

	// User
	app.post("/v2/user/generateReport", isUserAuthenticated(ApiKeyAccessType.Read), validateBody(validateUserReportSchema), generateReport)
}
