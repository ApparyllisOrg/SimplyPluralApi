import { SimplyDocumentBase } from "../document"
import { Frame } from "../frameType"

export interface User extends SimplyDocumentBase {
	username?: string
	desc?: string
	isAsystem?: boolean
	avatarUuid?: string
	avatarUrl?: string
	color?: string
	supperDesckMarkdown?: boolean
	fields?: {
		[Key: string]: {
			name: string
			order: number
			private: boolean
			preventTrusted: boolean
			type: number
			supportMarkdown?: boolean
		}
	}
	frame?: Frame
}
