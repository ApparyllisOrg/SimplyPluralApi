import { PrivacyBucketDocument, SimplyDocumentBase } from "../document"

export interface FriendSettings extends SimplyDocumentBase, PrivacyBucketDocument {
	frienduid: string
	seeMembers?: boolean
	seeFront?: boolean
	getFrontNotif?: boolean
	getTheirFrontNotif?: boolean
	trusted?: boolean
}
