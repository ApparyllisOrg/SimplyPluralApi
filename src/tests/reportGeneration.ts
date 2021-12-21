import * as assert from "assert";
import { writeFile } from "fs";
import * as mocha from "mocha"
import { validateUserReportSchema } from "../api/v1/user";
import { generateUserReport } from "../api/v1/user/generateReport";
import { init, isLive } from "../modules/mongo";

describe("validate generate report schemas", () => {
	mocha.test("Test valid generate report schema", () => {
		const result = validateUserReportSchema({
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
			frontHistory: null,
			members: null,
			customFronts: null
		});

		assert.strictEqual(result.success, true, result.msg);
	});

	mocha.test("Test invalid generate report schema", () => {
		const result = validateUserReportSchema({
			frontHistory: {},
			members: {},
			customFronts: {}
		});

		assert.strictEqual(result.success, false, result.msg);
	});

	mocha.test("Generate user report", async () => {
		try {
			await init(false)
		} catch (e) {
			// If this fails, we have no mongodb...
			return;
		}
		if (isLive()) {
			try {
				const now = Date.now();
				const report = await generateUserReport({
					frontHistory: {
						privacyLevel: 2,
						start: now - 1.21e+9, // 14 days
						end: now,
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
				}, "rXH5xlieFOZ4ulqAlLv3YXLmn532");
				writeFile("./developer/generateReportResult.html", report, (_err) => {//
				});
				assert.strictEqual(!!report, true, "Failed to generate a user report");
			} catch (e) {
				assert.strictEqual(false, true, e as string);
			}
		}
	});
});