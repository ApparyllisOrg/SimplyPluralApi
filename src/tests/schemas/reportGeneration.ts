import * as assert from "assert";
import { writeFile } from "fs";
import * as mocha from "mocha"
import { validateUserReportSchema } from "../../api/v1/user";
import { generateUserReport } from "../../api/v1/user/generateReport";

describe("validate generate report schemas", () => {
	mocha.test("Test valid generate report schema", () => {
		const result = validateUserReportSchema({
			sendTo: "celeste@saltypandastudios.com",
			frontHistory: {
				privacyLevel: 2,
				start: 0,
				end: 9999999999999999,
				includeMembers: true,
				includeCustomFronts: true,
			},
			members: {
				privacyLevel: 2,
				includeCustomFields: true
			},
			customFronts: {
				privacyLevel: 2,
			}
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test valid null generate report schema", () => {
		const result = validateUserReportSchema({
			sendTo: "celeste@saltypandastudios.com",
			frontHistory: null,
			members: null,
			customFronts: null
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid generate report schema", () => {
		const result = validateUserReportSchema({
			sendTo: null,
			frontHistory: {},
			members: {},
			customFronts: {}
		});

		assert.strictEqual(result.success, false, result.msg);
	});
});
