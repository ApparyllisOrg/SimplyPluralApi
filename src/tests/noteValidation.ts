import * as assert from "assert";
import * as mocha from "mocha"
import { validateNoteSchema } from "../api/plural/v1/note";

describe("validate note schemas", () => {
	mocha.test("Test valid note schema", () => {
		const result = validateNoteSchema({
			title: "foo",
			note: "foo",
			color: "foo",
			date: "foo",
			member: "foo",
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid note schema", () => {
		const result = validateNoteSchema({
			title: null,
			note: null,
			color: null,
			date: null,
			member: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});