import { Frame } from "../frameType"

import { PrivacyBucketDocument, SimplyDocumentBase } from "../document"

export interface CustomFront extends SimplyDocumentBase, PrivacyBucketDocument {
	name: string
	desc?: string
	color?: string
	avatarUuid?: string
	avatarUrl?: string
	private?: boolean
	preventTrusted?: boolean
	supportDescMarkdown?: boolean
	frame?: Frame
}
