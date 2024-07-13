import { Frame } from "../frameType"
import { PrivacyBucketDocument, SimplyDocumentBase } from "../document"

export interface Member extends SimplyDocumentBase, PrivacyBucketDocument {
	name: string
	desc?: string
	pronouns?: string
	pkId?: string
	color?: string
	avatarUuid?: string
	avatarUrl?: string
	private?: boolean
	preventTrusted?: boolean
	preventsFrontNotifs?: boolean
	info?: { [Key: string]: string }
	supportDescMarkdown?: boolean
	archived?: boolean
	receiveMessageBoardNotifs?: boolean
	archivedReason?: string
	frame?: Frame
}
