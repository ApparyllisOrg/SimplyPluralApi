import { PrivacyBucketDocument, SimplyDocumentBase } from "../document"

export interface Group extends SimplyDocumentBase, PrivacyBucketDocument {
	name: string
	desc: string
	color: boolean
	emoji: string
	parent: string
	members: string[]
	private?: boolean
	preventTrusted?: boolean
	supportDescMarkdown?: string
}
