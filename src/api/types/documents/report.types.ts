import { SimplyDocumentBase } from "../document"

export interface Report extends SimplyDocumentBase {
	url: string
	createdAt: number
	usedSettings: {
		sendTo: string
		cc: string[]
		frontHistory: {
			start: number
			end: number
			includeMembers: boolean
			includeCustomFronts: boolean
			privacyLevel: number
		}
		members: {
			includeCustomFields: boolean
			privacyLevel: number
		}
		customFronts: {
			privacyLevel: number
		}
	}
}
