import axios from "axios";
import * as mocha from "mocha"
import { getTestAxiosUrl, getTestToken } from "../utils";
import {decryptMessage, encryptMessage} from "../../api/v1/chat/chat.core"
import { assert } from "chai";

describe("validate chat encryption", () => {
	const msg : string = "Hello World!"

	let encryptedMsg = "";
	let iv = "";

	mocha.test("Test encryption", async () => {
		const encrypted = encryptMessage(msg)
		encryptedMsg = encrypted.msg
		iv = encrypted.iv
		assert(encrypted.msg !== msg, "Ensure encrypted message does not equal original msg")
	});

	mocha.test("Test decryption", async () => {
		const decrypted = decryptMessage(encryptedMsg, iv)
		assert(decrypted === msg, "Ensure decrypted message equals original msg")
	});
})