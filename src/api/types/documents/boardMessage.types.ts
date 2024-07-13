import { SimplyDocumentBase } from "../document"

export interface BoardMessage extends SimplyDocumentBase {
	title: string
	message: string
	writtenBy: string
	writtenFor: string
	read: boolean
	writtenAt: number
	supportMarkdown: boolean
}
