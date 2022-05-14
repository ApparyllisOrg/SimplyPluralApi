
import * as core from 'express-serve-static-core';
import { ApiKeyAccessType } from '../../modules/api/keys';
import { isUserAuthenticated, isUserAppJwtAuthenticated } from '../../security/auth';
import { validateBody, validateId, validateQuery } from '../../util/validation';
import * as customFront from './customFront';
import * as member from './member';
import * as note from './note';
import * as automatedTimer from './automatedTimer';
import * as repeatedTimer from './repeatedTimer';
import * as group from './group';
import * as comment from './comment';
import * as user from './user';
import * as priv from './private';
import * as friend from './friend';
import * as poll from './poll';
import * as storage from './storage';
import * as friendActions from './friendActions';
import * as frontHistory from './frontHistory';
import * as pk from './pk';
import * as token from './tokens';

// Todo: Verify all access types are setup correctly before moving to production
export const setupV1routes = (app: core.Express) => {
	// Members
	app.get("/v1/member/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), member.get)
	app.get("/v1/members/:system", isUserAuthenticated(ApiKeyAccessType.Read), member.getMembers)
	app.post("/v1/member/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(member.validateMemberSchema), validateId, member.add)
	app.patch("/v1/member/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(member.validateMemberSchema), member.update)
	app.delete("/v1/member/:id", isUserAuthenticated(ApiKeyAccessType.Delete), member.del)

	// Notes
	app.get("/v1/note/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), note.get)
	app.get("/v1/notes/:system/:member", isUserAuthenticated(ApiKeyAccessType.Read), note.getNotesForMember)
	app.post("/v1/note/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(note.validateNoteSchema), validateId, note.add)
	app.patch("/v1/note/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(note.validateNoteSchema), note.update)
	app.delete("/v1/note/:id", isUserAuthenticated(ApiKeyAccessType.Delete), note.del)

	// Custom front
	app.get("/v1/customFront/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), customFront.get)
	app.get("/v1/customFronts/:system", isUserAuthenticated(ApiKeyAccessType.Read), customFront.getCustomFronts)
	app.post("/v1/customFront/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(customFront.validateCustomFrontSchema), validateId, customFront.add)
	app.patch("/v1/customFront/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(customFront.validateCustomFrontSchema), customFront.update)
	app.delete("/v1/customFront/:id", isUserAuthenticated(ApiKeyAccessType.Delete), customFront.del)

	// Comments
	app.get("/v1/comments/:type/:id", isUserAuthenticated(ApiKeyAccessType.Read), comment.getCommentsForDocument)
	app.get("/v1/comment/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), comment.get)
	app.post("/v1/comment/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(comment.validateCommentSchema), validateId, comment.add)
	app.patch("/v1/comment/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(comment.validateCommentPatchSchema), comment.update)
	app.delete("/v1/comment/:id", isUserAuthenticated(ApiKeyAccessType.Delete), comment.del)

	// Polls
	app.get("/v1/polls/:system", isUserAuthenticated(ApiKeyAccessType.Read), poll.getPolls)
	app.get("/v1/poll/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), poll.get)
	app.post("/v1/poll/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(poll.validatePollSchema), validateId, poll.add)
	app.patch("/v1/poll/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(poll.validatePollSchema), poll.update)
	app.delete("/v1/poll/:id", isUserAuthenticated(ApiKeyAccessType.Delete), poll.del)

	// Automated timers
	app.get("/v1/timers/automated/:system/", isUserAuthenticated(ApiKeyAccessType.Read), automatedTimer.getAutomatedTimers)
	app.get("/v1/timer/automated/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), automatedTimer.get)
	app.post("/v1/timer/automated/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(automatedTimer.validateAutomatedTimerSchema), validateId, automatedTimer.add)
	app.patch("/v1/timer/automated/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(automatedTimer.validateAutomatedTimerSchema), automatedTimer.update)
	app.delete("/v1/timer/automated/:id", isUserAuthenticated(ApiKeyAccessType.Delete), automatedTimer.del)

	// Repeated timers
	app.get("/v1/timers/repeated/:system/", isUserAuthenticated(ApiKeyAccessType.Read), repeatedTimer.getRepeatedTimers)
	app.get("/v1/timer/repeated/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), repeatedTimer.get)
	app.post("/v1/timer/repeated/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(repeatedTimer.validateRepeatedTimerSchema), validateId, repeatedTimer.add)
	app.patch("/v1/timer/repeated/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(repeatedTimer.validateRepeatedTimerSchema), repeatedTimer.update)
	app.delete("/v1/timer/repeated/:id", isUserAuthenticated(ApiKeyAccessType.Delete), repeatedTimer.del)

	// Fronting
	app.get("/v1/fronters/", isUserAuthenticated(ApiKeyAccessType.Read), frontHistory.getFronters)

	// Front History
	app.get("/v1/frontHistory/:system", isUserAuthenticated(ApiKeyAccessType.Read), validateQuery(frontHistory.validateGetfrontHistorychema), frontHistory.getFrontHistoryInRange)
	app.get("/v1/frontHistory", isUserAuthenticated(ApiKeyAccessType.Read), frontHistory.getFrontHistory)
	app.get("/v1/frontHistory/member/:id", isUserAuthenticated(ApiKeyAccessType.Read), frontHistory.getFrontHistoryForMember)
	app.get("/v1/frontHistory/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), frontHistory.get)
	app.post("/v1/frontHistory/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(frontHistory.validatefrontHistoryPostSchema), validateId, frontHistory.add)
	app.patch("/v1/frontHistory/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(frontHistory.validatefrontHistoryPatchSchema), frontHistory.update)
	app.delete("/v1/frontHistory/:id", isUserAuthenticated(ApiKeyAccessType.Delete), frontHistory.del)

	// Groups
	app.get("/v1/group/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), group.get)
	app.get("/v1/groups/:system", isUserAuthenticated(ApiKeyAccessType.Read), group.getGroups)
	app.post("/v1/group/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(group.validateGroupSchema), validateId, group.add)
	app.patch("/v1/group/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(group.validateGroupSchema), group.update)
	app.delete("/v1/group/:id", isUserAuthenticated(ApiKeyAccessType.Delete), group.del)

	// User
	app.get("/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Read), user.get)
	app.get("/v1/user/:id/reports", isUserAuthenticated(ApiKeyAccessType.Read), user.getReports)
	app.delete("/v1/user/:id/report/:reportid", isUserAppJwtAuthenticated, user.deleteReport)
	app.post("/v1/user/generateReport", isUserAuthenticated(ApiKeyAccessType.Read), validateBody(user.validateUserReportSchema), user.generateReport)
	app.patch("/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(user.validateUserSchema), user.update)
	app.patch("/v1/user/username/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(user.validateUsernameSchema), user.SetUsername)
	app.delete("/v1/user/:id", isUserAppJwtAuthenticated, user.deleteAccount)

	// Private
	app.get("/v1/user/private/:id", isUserAppJwtAuthenticated, priv.get)
	app.patch("/v1/user/private/:id", isUserAppJwtAuthenticated, validateBody(priv.validatePrivateSchema), priv.update)
	app.get("/v1/private/:id", isUserAppJwtAuthenticated, priv.get)
	app.patch("/v1/private/:id", isUserAppJwtAuthenticated, validateBody(priv.validatePrivateSchema), priv.update)

	// Friends
	app.get("/v1/friends/", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriends)
	app.get("/v1/friends/requests/incoming", isUserAuthenticated(ApiKeyAccessType.Read), friend.getIngoingFriendRequests)
	app.get("/v1/friends/requests/outgoing", isUserAuthenticated(ApiKeyAccessType.Read), friend.getOutgoingFriendRequests)
	app.get("/v1/friends/getFrontValues", isUserAuthenticated(ApiKeyAccessType.Read), friend.getAllFriendFrontValues);
	app.get("/v1/friend/:system/getFrontValue", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriendFrontValues);
	app.post("/v1/friends/request/add/:id", isUserAuthenticated(ApiKeyAccessType.Write), friendActions.AddFriend)
	app.post("/v1/friends/request/respond/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(friendActions.validateRespondToFrienqRequestSchema), friendActions.RespondToFriendRequest)
	app.delete("/v1/friends/request/:id", isUserAuthenticated(ApiKeyAccessType.Delete), friendActions.CancelFriendRequest)
	app.delete("/v1/friends/remove/:id", isUserAuthenticated(ApiKeyAccessType.Delete), friendActions.RemoveFriend)

	// Friend
	app.get("/v1/friend/:id/getFront", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriendFront)
	app.get("/v1/friend/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriend)
	app.patch("/v1/friend/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(friend.validatePatchFriendSchema), friend.updateFriend)

	// Avatar
	app.post("/v1/avatar/:id", isUserAppJwtAuthenticated, validateBody(storage.validateStoreAvatarSchema), storage.Store)
	app.delete("/v1/avatar/:id", isUserAppJwtAuthenticated, storage.Delete)

	// Sync members
	app.patch("/v1/integrations/pluralkit/sync/member/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(pk.validateSyncMemberSchema), validateQuery(pk.validateSyncDirectionSchema), pk.performSyncMember)
	app.patch("/v1/integrations/pluralkit/sync/members", isUserAuthenticated(ApiKeyAccessType.Write), validateBody(pk.validateSyncMembersSchema), validateQuery(pk.validateSyncDirectionSchema), pk.performSyncAllMembers)

	// Tokens
	app.get("/v1/tokens", isUserAppJwtAuthenticated, token.getAll)
	app.get("/v1/token/:id", isUserAppJwtAuthenticated, token.get)
	app.post("/v1/token/:id", isUserAppJwtAuthenticated, validateBody(token.validateApiKeySchema), token.add)
	app.delete("/v1/token/:id", isUserAppJwtAuthenticated, token.del)
}
