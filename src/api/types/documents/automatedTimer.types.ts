import { SimplyDocumentBase } from "../document"

export interface AutomatedTimer extends SimplyDocumentBase {
	name: string
	message: string
	delayInHours: number
	type: number
	action?: number
}
