import * as assert from "assert";
import { assignApiKey, generateNewApiKey } from "../../modules/api/keys";

describe("validate token system", async () => {
	describe("Test valid token generation", async () => {
		const token = await generateNewApiKey();
		assert.strictEqual(token.length == 64, true, "Token is of invalid length");
	});

	describe("Assign no-access token", async () => {
		const token = await generateNewApiKey();
		const success = await assignApiKey(false, false, false, token, "foo");
		assert.strictEqual(success, false, "Managed to assign a no-access token");
	});
});
