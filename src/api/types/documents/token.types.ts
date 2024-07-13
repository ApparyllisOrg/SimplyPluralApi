import { SimplyDocumentBase } from "../document"

export interface Token extends SimplyDocumentBase {
	token: string
	permission: number
}
