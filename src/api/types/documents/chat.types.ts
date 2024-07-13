import { SimplyDocumentBase } from "../document"

export interface ChatMessage extends SimplyDocumentBase {
	message: string
	channel: string
	writer: string
	writtenAt: number
	iv: string
	updatedAt?: number
	replyTo?: string
}

export interface Channel extends SimplyDocumentBase {
	name: string
	desc: string
}

export interface ChannelCategory extends SimplyDocumentBase {
	name: string
	desc: string
	channels?: string[]
}
