import WebSocket from "ws";
import { isUserSuspended } from "../../security";
import { validateToken } from "../../security/auth";
import { userLog } from "../logger";

export type destroyCallback = () => void;
export default class Connection {
	constructor(private ws: WebSocket | undefined, public uid: string | undefined) {
		ws?.on("close", this.onClose);
		ws?.on("error", this.onError);
		ws?.on("message", this.onMessage);
		ws?.on("pong", () => {
			ws.ping();
		});
	}

	private onMessage = async (message: string) => {
		if (message == "ping") {
			return this.send("pong");
		}

		let json;
		try {
			json = JSON.parse(message);
		} catch (e) {
			return this.send(JSON.stringify({ msg: "Invalid message, cannot parse Json." }));
		}

		if (json.op == null) return this.send(JSON.stringify({ msg: "Missing 'op' in message." }));

		switch (json.op as string) {
		case "authenticate":
			return this.handleAuth(json.token);
		}
	};

	private handleAuth = async (token: string) => {
		const resolvedToken = await validateToken(token);

		if (resolvedToken.accessType == 0) {
			return this.send({ msg: "Authentication violation: Token is missing or invalid. Goodbye :)" }, true);
		}

		const isSuspended = await isUserSuspended(resolvedToken.uid!);
		if (isSuspended) {
			return this.send({ msg: "Authentication violation: Your account is suspended" }, true);
		}

		this.uid = resolvedToken.uid;
		this.send({ msg: "Successfully authenticated", resolvedToken });
	};

	private onClose() {
		this.ws?.removeAllListeners();
		this.ws = undefined;
		this.uid = undefined;
	}

	private onError(err: any) {
		try {
			userLog(this.uid ?? "undefined user", err.toString());
		} catch (e) {
			userLog(this.uid ?? "undefined user", "Websocket error occurred");
		}
	}

	async send(data: any, close = false) {
		if (typeof data === "string") this.ws?.send(data);
		else this.ws?.send(JSON.stringify(data));
		if (close) this.ws?.close();
	}
}
