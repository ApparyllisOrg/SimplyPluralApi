import { SimplyDocumentBase } from "../document"

export interface Comment extends SimplyDocumentBase {
	time: number
	text: string
	documentId: string
	collection: string
	supportMarkdown?: boolean
}
