import { SimplyDocumentBase } from "../document"

export interface PrivacyBucket extends SimplyDocumentBase {
	name: string
	desc: string
	color: string
	icon: string
	rank: string
}
