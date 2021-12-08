
import { dispatch, ChangeEvent } from "../socket";
import { client } from "./dispatchClient";

export const publishDbEvent = (event: ChangeEvent) => {
	client.publish("dbevent", JSON.stringify(event));
}

export const dispathDbEventReceived = (event: ChangeEvent) => {
	dispatch(event);
}