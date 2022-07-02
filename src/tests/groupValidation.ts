import * as assert from "assert";
import * as mocha from "mocha"
import { validateGroupSchema } from "../api/plural/v1/group";

describe("validate group schemas", () => {
	mocha.test("Test valid group schema", () => {
		const result = validateGroupSchema({
			parent: "foo",
			color: "foo",
			private: true,
			preventTrusted: true,
			name: "foo",
			desc: "foo",
			emoji: "foo",
			members: ["foo", "bar"]
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid private group schema", () => {
		const result = validateGroupSchema({
			private: true,
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Test invalid private group schema", () => {
		const result = validateGroupSchema({
			private: false,
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Test valid private group schema", () => {
		const result = validateGroupSchema({
			private: false,
			preventTrusted: false,
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid group schema", () => {
		const result = validateGroupSchema({
			parent: null,
			color: null,
			private: null,
			preventTrusted: null,
			name: null,
			desc: null,
			emoji: null,
			members: [null, null]
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});