import WebSocket from "ws";
import { validateToken } from "../../security/auth";

export type destroyCallback = () => void;
export default class Connection {
	constructor(private ws: WebSocket | undefined, public uid: string | undefined) {
		ws?.on('close', this.onClose);
		ws?.on('message', this.onMessage);
	}

	private onMessage = async (message: string) => {

		// Ignore ping messages
		if (message === "ping") return;

		let json;
		try {
			json = JSON.parse(message);
		} catch (e) {
			return this.send(JSON.stringify({ msg: "Invalid message, cannot parse Json." }));
		}

		if (json.op == null)
			return this.send(JSON.stringify({ msg: "Missing 'op' in message." }));

		switch (json.op as string) {
			case "authenticate":
				return this.handleAuth(json.token);
		}
	}

	private handleAuth = async (token: string) => {
		const resolvedToken = await validateToken(token);

		const validatedUid = await validateToken(token);
		if (!validatedUid)
			return this.send({ msg: "Authentication violation: Token is missing or invalid. Goodbye :)" }, true);

		this.uid = resolvedToken.uid;
		console.log(this.uid)
		this.send({ msg: "Successfully authenticated", validatedUid });
	}

	private onClose() {
		this.ws?.removeAllListeners();
		this.ws = undefined;
		this.uid = undefined;
	}

	async send(data: any, close = false) {
		if (typeof data === "string")
			this.ws?.send(data);
		else
			this.ws?.send(JSON.stringify(data));
		if (close)
			this.ws?.close();
	}
}
