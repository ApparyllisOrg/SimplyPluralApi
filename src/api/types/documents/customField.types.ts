import { PrivacyBucketDocument, SimplyDocumentBase } from "../document"

export interface CustomField extends SimplyDocumentBase, PrivacyBucketDocument {
	name: string
	order: number
	type: string
	supportMarkdown: boolean
}
