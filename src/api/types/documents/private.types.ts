import { SimplyDocumentBase } from "../document"

export interface PrivateUser extends SimplyDocumentBase {
	// Legacy-compat: Notification token used to be a single string
	notificationToken?: string[] | string
	lastUpdate?: number
	latestVersion?: number
	location?: string
	termsOfServicesAccepted?: boolean
	whatsNew?: number
	auditContentChanges?: boolean
	generationsLeft?: number
	bypassGenerationLimit?: boolean
	hideAudits?: boolean
	auditRetention?: number
	categories?: string[]
	defaultPrivacy?: {
		members: string[]
		groups: string[]
		customFronts: string[]
		customFields: string[]
	}
}
