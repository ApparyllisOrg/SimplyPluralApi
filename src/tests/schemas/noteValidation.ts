import * as assert from "assert";
import * as mocha from "mocha";
import { validateNoteSchema, validatePostNoteSchema } from "../../api/v1/note";

describe("validate note schemas", () => {
	mocha.test("Test valid note schema", () => {
		const result = validatePostNoteSchema({
			title: "foo",
			note: "foo",
			color: "foo",
			date: 0,
			member: "foo",
			supportMarkdown: true,
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid note schema", () => {
		const result = validatePostNoteSchema({
			title: null,
			note: null,
			color: null,
			date: null,
			member: null,
			supportMarkdown: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Test valid post note schema", () => {
		const result = validateNoteSchema({
			title: "foo",
			note: "foo",
			color: "foo",
			supportMarkdown: true,
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid post note schema", () => {
		const result = validateNoteSchema({
			title: null,
			note: null,
			color: null,
			supportMarkdown: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});
