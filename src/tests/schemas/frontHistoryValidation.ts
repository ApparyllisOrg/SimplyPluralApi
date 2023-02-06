import * as assert from "assert";
import * as mocha from "mocha";
import { validatefrontHistoryPostSchema, validateGetfrontHistorychema, validatefrontHistoryPatchSchema } from "../../api/v1/frontHistory";

describe("validate front history schemas", () => {
	mocha.test("Test valid post front history schema", () => {
		const result = validatefrontHistoryPostSchema({
			custom: true,
			live: true,
			startTime: 0,
			endTime: 0,
			member: "foo",
			customStatus: "Some Status",
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid post front history schema", () => {
		const result = validatefrontHistoryPostSchema({
			endTime: null,
			customStatus: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Test valid patch front history schema", () => {
		const result = validatefrontHistoryPatchSchema({
			custom: true,
			live: true,
			startTime: 0,
			endTime: 0,
			member: "foo",
			customStatus: "Some Status",
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid patch front history schema", () => {
		const result = validatefrontHistoryPatchSchema({
			custom: null,
			live: null,
			startTime: null,
			endTime: null,
			member: null,
			customStatus: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Test valid get front history schema", () => {
		const result = validateGetfrontHistorychema({
			startTime: "0",
			endTime: "0",
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid get front history schema", () => {
		const result = validateGetfrontHistorychema({
			startTime: null,
			endTime: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});
