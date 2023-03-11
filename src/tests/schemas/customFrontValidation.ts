import * as assert from "assert";
import * as mocha from "mocha";
import { validateCustomFrontSchema } from "../../api/v1/customFront";

describe("validate custom front schemas", () => {
	mocha.test("Test valid custom front schema", () => {
		const result = validateCustomFrontSchema({
			name: "foo",
			desc: "foo",
			color: "foo",
			avatarUuid: "foo",
			avatarUrl: "foo",
			private: true,
			preventTrusted: true,
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid custom front schema", () => {
		const result = validateCustomFrontSchema({
			name: null,
			desc: null,
			color: null,
			avatarUuid: null,
			avatarUrl: null,
			private: null,
			preventTrusted: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});
