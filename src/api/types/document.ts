import { ObjectId } from "mongodb"
import { AutomatedTimer } from "./documents/automatedTimer.types"
import { BoardMessage } from "./documents/boardMessage.types"
import { CustomFront } from "./documents/custonFront.types"
import { Member } from "./documents/member.types"
import { Channel, ChannelCategory, ChatMessage } from "./documents/chat.types"
import { CustomField } from "./documents/customField.types"
import { FriendSettings } from "./documents/friend.types"
import { Note } from "./documents/note.types"
import { Poll } from "./documents/poll.types"
import { PrivacyBucket } from "./documents/privacyBucket.types"
import { RepeatedTimer } from "./documents/repeatedTimer.tyes"
import { Token } from "./documents/token.types"
import { User } from "./documents/user.types"
import { FrontHistoryEntry } from "./documents/frontHistory.types"
import { Group } from "./documents/group.types"
import { PrivateUser } from "./documents/private.types"
import { Comment } from "./documents/comment.types"
import { Report } from "./documents/report.types"
import { Account, VerifiedKeys } from "./documents/account.types"

export interface PrivacyBucketDocument {
	buckets: ObjectId[]
}

export type SimplyDocumentBase = { uid: string }
export type SimplyDocument =
	| Account
	| AutomatedTimer
	| BoardMessage
	| ChatMessage
	| Channel
	| ChannelCategory
	| Comment
	| CustomField
	| CustomFront
	| FriendSettings
	| FrontHistoryEntry
	| Group
	| Member
	| Note
	| Poll
	| PrivacyBucket
	| PrivateUser
	| RepeatedTimer
	| Report
	| Token
	| User
	| VerifiedKeys

export interface CollectionTypes {
	accounts: Account
	automatedReminders: AutomatedTimer
	boardMessages: BoardMessage
	chatMessages: ChatMessage
	channels: Channel
	channelCategories: ChannelCategory
	comments: Comment
	customFields: CustomField
	frontStatuses: CustomFront
	friends: FriendSettings
	frontHistory: FrontHistoryEntry
	groups: Group
	members: Member
	notes: Note
	polls: Poll
	privacyBuckets: PrivacyBucket
	private: PrivateUser
	repeatedReminders: RepeatedTimer
	reports: Report
	tokens: Token
	users: User
	verifiedKeys: VerifiedKeys
}
