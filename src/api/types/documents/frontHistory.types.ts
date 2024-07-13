import { SimplyDocumentBase } from "../document"

export interface FrontHistoryEntry extends SimplyDocumentBase {
	custom: boolean
	live: boolean
	startTime: number
	member: string
	endTime?: number
	customStatus?: string

	// Legacy-compat: Comments used to be stored on the front entry
	comments: { time: { _seconds: number; _nanoseconds: number }; text: string }[]
}
