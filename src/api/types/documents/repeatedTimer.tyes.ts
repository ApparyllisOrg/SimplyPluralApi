import { SimplyDocumentBase } from "../document"

export interface RepeatedTimer extends SimplyDocumentBase {
	name: string
	message: string
	dayInterval: number
	time: {
		hour: number
		minute: number
	}
	startTime: {
		year: number
		month: number
		day: number
	}
}
