import WebSocket from "ws";
import { validateToken } from "../../security/auth";

export type destroyCallback = () => void;
export default class Connection {
	uid?: string;

	constructor(private ws: WebSocket | undefined) {
		ws?.on('close', this.onClose);
		ws?.on('message', this.onMessage);
	}

	private async onMessage(message: string) {
		let json;
		try {
			json = JSON.parse(message);
		} catch (e) {
			return this.send({ msg: "Invalid message, cannot parse Json." });
		}

		if (json.op == null)
			return this.send({ msg: "Missing 'op' in message." });

		switch (json.op as string) {
			case "authenticate":
				return this.handleAuth(json.token);
		}
	}

	private async handleAuth(token: string) {
		const resolvedToken = await validateToken(token);

		const uid = await validateToken(token);
		if (!uid)
			return this.send({ msg: "Authentication violation: Token is missing or invalid. Goodbye :)" }, true);

		this.uid = resolvedToken.uid;
		this.send({ msg: "Successfully authenticated", uid });
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
