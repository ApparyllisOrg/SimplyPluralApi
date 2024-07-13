import { SimplyDocumentBase } from "../document"

export interface Poll extends SimplyDocumentBase {
	name: string
	desc: string
	custom: boolean
	endTime: number

	votes?: { id: string; comment: string; vote: string }[]

	supportDescMarkdown?: boolean

	// Normal poll properties
	allowAbstain?: boolean
	allowVeto?: boolean

	// Custom poll properties
	options?: { name: string; color: string }[]
}
