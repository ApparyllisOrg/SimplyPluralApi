import * as assert from "assert";
import * as mocha from "mocha"
import { validateUserSchema } from "../api/plural/v1/user";

describe("validate user schemas", () => {
	mocha.test("Test valid user schema", () => {
		const result = validateUserSchema({
			shownMigration: true,
			desc: "foo",
			fromFirebase: true,
			isAsystem: true,
			avatarUuid: "foo",
			color: "foo",
			fields: {
				mrQ68BP8sDXQvGANYQwwyg: {
					name: "a",
					order: 0,
					private: true,
					preventTrusted: true,
					type: 0
				},
				dN7wKZFFNErEyRDkTurdg6: {
					name: "c",
					order: 2,
					private: true,
					preventTrusted: true,
					type: 0
				}
			}
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid user schema", () => {
		const result = validateUserSchema({
			shownMigration: true,
			desc: "foo",
			fromFirebase: true,
			isAsystem: true,
			avatarUuid: "foo",
			color: "foo",
			fields: {
				mrQ68BP8sDXQvGANYQwwyg: {
					name: 0,
					order: 0,
					private: true,
					preventTrusted: true,
					type: 0
				},
				dN7wKZFFNErEyRDkTurdg6: {
					name: 0,
					order: 2,
					private: true,
					preventTrusted: true,
					type: 0
				}
			}
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});