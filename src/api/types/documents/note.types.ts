import { SimplyDocumentBase } from "../document"

export interface Note extends SimplyDocumentBase {
	title: string
	note: string
	color: string
	member: string
	date: number
	supportMarkdown?: boolean
}
