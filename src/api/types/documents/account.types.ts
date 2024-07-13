import { SimplyDocumentBase } from "../document"

export interface Account extends SimplyDocumentBase {
	email: string
	verified: boolean
	registeredAt: Date
	salt?: string
	password?: string
	sub?: string
	oAuth2?: boolean
	suspended?: boolean
	firstValidJWtTime?: number
	lastConfirmationEmailSent?: number
	lastResetPasswordEmailSent?: number
	verificationCode?: string
	passwordResetToken?: string
}

export interface VerifiedKeys {
	key: string
	verified: boolean
}
