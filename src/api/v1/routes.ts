
import * as core from 'express-serve-static-core';
import { ApiKeyAccessType } from '../../modules/api/keys';
import { isUserAuthenticated, isUserAppJwtAuthenticated } from '../../security/auth';
import { validateId, validateQuery } from '../../util/validation';
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
import * as frontHistrory from './frontHistory';
import * as pk from './pk';

// Todo: Verify all access types are setup correctly before moving to procuction
export const setupV1routes = (app: core.Express) => {
	// Members
	app.get("/v1/member/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), member.get)
	app.get("/v1/members/:system", isUserAuthenticated(ApiKeyAccessType.Read), member.getMembers)
	app.post("/v1/member/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(member.validateMemberSchema), validateId, member.add)
	app.patch("/v1/member/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(member.validateMemberSchema), member.update)
	app.delete("/v1/member/:id", isUserAuthenticated(ApiKeyAccessType.Delete), member.del)

	// Notes
	app.get("/v1/note/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), note.get)
	app.get("/v1/notes/:system/:member", isUserAuthenticated(ApiKeyAccessType.Read), note.getNotesForMember)
	app.post("/v1/note/:id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(note.validateNoteSchema), validateId, note.add)
	app.patch("/v1/note/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(note.validateNoteSchema), note.update)
	app.delete("/v1/note/:id", isUserAuthenticated(ApiKeyAccessType.Delete), note.del)

	// Custom front
	app.get("/v1/customFront/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), customFront.get)
	app.get("/v1/customFronts/:system", isUserAuthenticated(ApiKeyAccessType.Read), customFront.getCustomFronts)
	app.post("/v1/customFront/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(customFront.validateCustomFrontSchema), validateId, customFront.add)
	app.patch("/v1/customFront/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(customFront.validateCustomFrontSchema), customFront.update)
	app.delete("/v1/customFront/:id", isUserAuthenticated(ApiKeyAccessType.Delete), customFront.del)

	// Comments
	app.get("/v1/comments/:id", isUserAuthenticated(ApiKeyAccessType.Read), comment.getCommentsForDocument)
	app.get("/v1/comment/:id", isUserAuthenticated(ApiKeyAccessType.Read), comment.get)
	app.post("/v1/comment/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(comment.validateCommentSchema), validateId, comment.add)
	app.patch("/v1/comment/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(comment.validateUpdateCommentSchema), comment.update)
	app.delete("/v1/comment/:id", isUserAuthenticated(ApiKeyAccessType.Delete), comment.del)

	// Polls
	app.get("/v1/polls/:system", isUserAuthenticated(ApiKeyAccessType.Read), poll.getPolls)
	app.get("/v1/poll/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), poll.get)
	app.post("/v1/poll/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(poll.validatePollSchema), validateId, poll.add)
	app.patch("/v1/poll/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(poll.validatePollSchema), poll.update)
	app.delete("/v1/poll/:id", isUserAuthenticated(ApiKeyAccessType.Delete), poll.del)

	// Automated timers
	app.get("/v1/timers/automated/:system/", isUserAuthenticated(ApiKeyAccessType.Read), automatedTimer.getAutomatedTimers)
	app.get("/v1/timer/automated/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), automatedTimer.get)
	app.post("/v1/timer/automated/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(automatedTimer.validateAutomatedTimerSchema), validateId, automatedTimer.add)
	app.patch("/v1/timer/automated/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(automatedTimer.validateAutomatedTimerSchema), automatedTimer.update)
	app.delete("/v1/timer/automated/:id", isUserAuthenticated(ApiKeyAccessType.Delete), automatedTimer.del)

	// Repeated timers
	app.get("/v1/timers/repeated/:system/", isUserAuthenticated(ApiKeyAccessType.Read), repeatedTimer.getRepeatedTimers)
	app.get("/v1/timer/repeated/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), repeatedTimer.get)
	app.post("/v1/timer/repeated/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(repeatedTimer.validateRepeatedTimerSchema), validateId, repeatedTimer.add)
	app.patch("/v1/timer/repeated/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(repeatedTimer.validateRepeatedTimerSchema), repeatedTimer.update)
	app.delete("/v1/timer/repeated/:id", isUserAuthenticated(ApiKeyAccessType.Delete), repeatedTimer.del)

	// Fronting
	app.get("/v1/fronters/", isUserAuthenticated(ApiKeyAccessType.Read), frontHistrory.getFronters)

	// Front History
	app.get("/v1/frontHistory/:system", isUserAuthenticated(ApiKeyAccessType.Read), frontHistrory.getFrontHistoryInRange)
	app.get("/v1/frontHistory/member/:id", isUserAuthenticated(ApiKeyAccessType.Read), frontHistrory.getFrontHistoryForMember)
	app.get("/v1/frontHistory/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), frontHistrory.get)
	app.post("/v1/frontHistory/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(frontHistrory.validatefrontHistorySchema), validateId, frontHistrory.add)
	app.patch("/v1/frontHistory/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(frontHistrory.validatefrontHistorySchema), frontHistrory.update)
	app.delete("/v1/frontHistoryd/:id", isUserAuthenticated(ApiKeyAccessType.Delete), frontHistrory.del)

	// Groups
	app.get("/v1/group/:system/:id", isUserAuthenticated(ApiKeyAccessType.Read), group.get)
	app.get("/v1/groups/:system", isUserAuthenticated(ApiKeyAccessType.Read), group.getGroups)
	app.post("/v1/group/id?", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(group.validateGroupSchema), validateId, group.add)
	app.patch("/v1/group/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(group.validateGroupSchema), group.update)
	app.delete("/v1/group/:id", isUserAuthenticated(ApiKeyAccessType.Delete), group.del)

	// User
	app.get("/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Read), user.get)
	app.get("v1/user/generateReport/", isUserAuthenticated(ApiKeyAccessType.Read), validateQuery(user.validateUserReportSchema), user.generateReport)
	app.patch("/v1/user/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(user.validateUserSchema), user.update)
	app.patch("/v1/user/username/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(user.validateUsernameSchema), user.SetUsername)
	app.delete("/v1/user/:id", isUserAppJwtAuthenticated, user.deleteAccount)

	// Private
	app.get("/v1/user/private/:id", isUserAppJwtAuthenticated, priv.get)
	app.patch("/v1/user/private/:id", isUserAppJwtAuthenticated, validateQuery(priv.validatePrivateSchema), priv.update)

	// Friends
	app.get("/v1/friends/", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriends)
	app.get("/v1/friends/requests/incoming", isUserAuthenticated(ApiKeyAccessType.Read), friend.getIngoingFriendRequests)
	app.get("/v1/friends/requests/outgoing", isUserAuthenticated(ApiKeyAccessType.Read), friend.getOutgoingFriendRequests)
	app.get("/v1/friends/getFrontValues", isUserAuthenticated(ApiKeyAccessType.Read), friend.getAllFriendFrontValues);
	app.get("/v1/friend/:system/getFrontValues", isUserAuthenticated(ApiKeyAccessType.Read), friend.getAllFriendFrontValues);
	app.post("/v1/friends/request/add/:id", isUserAuthenticated(ApiKeyAccessType.Write), friendActions.AddFriend)
	app.post("/v1/friends/request/respond/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(friendActions.validateRespondToFrienqRequestSchema), friendActions.RespondToFriendRequest)
	app.delete("/v1/friends/request/:id", isUserAuthenticated(ApiKeyAccessType.Delete), friendActions.CancelFriendRequest)
	app.delete("/v1/friends/remove/:id", isUserAuthenticated(ApiKeyAccessType.Delete), friendActions.RemoveFriend)

	// Friend
	app.get("/v1/friend/:id/getFront", isUserAuthenticated(ApiKeyAccessType.Read), friend.getFriendFront)
	app.get("/v1/friend/:id", isUserAuthenticated(ApiKeyAccessType.Write), friend.updateFriend)
	app.patch("/v1/friend/:id", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(friend.validatePatchFriendSchema), friend.getFriend)

	// Avatar
	app.post("/v1/avatar/:id", isUserAppJwtAuthenticated, validateQuery(storage.validateStoreAvatarSchema), storage.Store)
	app.delete("/v1/avatar/:id", isUserAppJwtAuthenticated, storage.Delete)

	// Sync members
	app.patch("/v1/integrations/pluralkit/sync/member/to/pk", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(pk.validateSyncMemberSchema), pk.performSyncMemberToPk)
	app.patch("/v1/integrations/pluralkit/sync/member/from/pk", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(pk.validateSyncMemberSchema), pk.performSyncMemberFromPk)
	app.patch("/v1/integrations/pluralkit/sync/members/to/pk", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(pk.validateSyncMembersSchema), pk.performSyncAllMemberToPk)
	app.patch("/v1/integrations/pluralkit/sync/members/from/pk", isUserAuthenticated(ApiKeyAccessType.Write), validateQuery(pk.validateSyncMembersSchema), pk.performSyncAllMemberFromPk)
}