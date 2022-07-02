import * as assert from "assert";
import * as mocha from "mocha"
import { validateMemberSchema } from "../api/plural/v1/member";

describe("validate member schemas", () => {
	mocha.test("Test valid member schema", () => {
		const result = validateMemberSchema({
			name: "foo",
			desc: "foo",
			pronouns: "foo",
			pkId: "foo",
			avatarUuid: "foo",
			avatarUrl: "foo",
			color: "foo",
			private: true,
			preventTrusted: true,
			preventsFrontNotifs: true,
			info: {
				a: "foo",
				b: "foo"
			},
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid member schema", () => {
		let result = validateMemberSchema({
			name: null,
			desc: null,
			pronouns: null,
			pkId: null,
			avatarUuid: null,
			avatarUrl: null,
			private: null,
			color: null,
			preventTrusted: null,
			preventsFrontNotifs: null,
			info: {
				a: null,
				b: null
			},
		});

		assert.strictEqual(result.success, false, result.msg);

		result = validateMemberSchema({
			name: null,
			desc: null,
			pronouns: null,
			pkId: null,
			avatarUuid: null,
			avatarUrl: null,
			private: null,
			color: null,
			preventTrusted: null,
			preventsFrontNotifs: null,
			info: null,
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});