import assert from "assert"
import * as mocha from "mocha"
import { expect } from "chai"
import axios from "axios"
import { AccountState, registerAccount, setupFront, testCustomFieldsMemberAccess, testFriendAccess, testFrontAccess, testNoFrontAccess, testNoTypeAccess, testTypeAccess } from "../access/utils"
import { getTestAxiosUrl } from "../../utils"

describe("validate migration version 300", () => {
	let acc_legacy: AccountState = { id: "", token: "" } // Legacy Account
	let buckets: { id: string; exists: boolean; content: { name: string } }[] = []

	let trustedFriendsBucketId = ""
	let friendsBucketId = ""

	mocha.test("Setup legacy test account", async () => {
		// Register account
		acc_legacy = await registerAccount(21, acc_legacy, 299)
	})

	mocha.test("Create test members", async () => {
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/member`),
				{ name: "Private", private: true, preventTrusted: true },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/member`),
				{ name: "Trusted Friend", private: true, preventTrusted: false },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/member`),
				{ name: "Friend", private: false, preventTrusted: false },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Create test group", async () => {
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/group`),
				{ name: "Private", private: true, preventTrusted: true, parent: "root", desc: "", color: "", emoji: "", members: [] },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/group`),
				{ name: "Trusted Friend", private: true, preventTrusted: false, parent: "root", desc: "", color: "", emoji: "", members: [] },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/group`),
				{ name: "Friend", private: false, preventTrusted: false, parent: "root", desc: "", color: "", emoji: "", members: [] },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Create test custom front", async () => {
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/customFront`),
				{ name: "Private", private: true, preventTrusted: true },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/customFront`),
				{ name: "Trusted Friend", private: true, preventTrusted: false },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/customFront`),
				{ name: "Friend", private: false, preventTrusted: false },
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Setup Custom Fields", async () => {
		{
			const result = await axios.patch(
				getTestAxiosUrl(`v1/user/${acc_legacy.id}`),
				{
					fields: {
						mdahghtpwgvtwrvvjgmdpw: {
							name: "Private",
							private: true,
							preventTrusted: true,
							order: 0,
							type: 0,
						},
						godvhwfczubhsqbmrrdvur: {
							name: "Trusted Friend",
							private: true,
							preventTrusted: false,
							order: 0,
							type: 0,
						},
						bduaoqidbrchrhtzximvcg: {
							name: "Friend",
							private: false,
							preventTrusted: false,
							order: 0,
							type: 0,
						},
					},
				},
				{ headers: { authorization: acc_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Update to 300", async () => {
		{
			const result = await axios.patch(getTestAxiosUrl(`v1/user/private/${acc_legacy.id}`), { latestVersion: 310 }, { headers: { authorization: acc_legacy.token }, validateStatus: () => true })
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Fetch Privacy Buckets", async () => {
		{
			const result = await axios.get(getTestAxiosUrl(`v1/privacyBuckets`), { headers: { authorization: acc_legacy.token }, validateStatus: () => true })
			expect(result.status).to.eq(200, result.data)

			buckets = result.data

			for (let i = 0; i < buckets.length; ++i) {
				const bucket = buckets[i]
				if (bucket.content.name === "Trusted friends") {
					trustedFriendsBucketId = bucket.id
				}

				if (bucket.content.name === "Friends") {
					friendsBucketId = bucket.id
				}
			}

			expect(trustedFriendsBucketId).to.not.eq("")
			expect(friendsBucketId).to.not.eq("")
			expect(friendsBucketId).to.not.eq(trustedFriendsBucketId)
		}
	})

	const testMigrationAccess = async (url: string) => {
		const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: acc_legacy.token }, validateStatus: () => true })

		expect(contentResult.status).to.eq(200, contentResult.data)

		if (Array.isArray(contentResult.data)) {
			expect(contentResult.data.length).to.eq(3, `${url} -> Test type access received an array but array length is mismatched`)

			for (let i = 0; i < contentResult.data.length; ++i) {
				let handled = false

				const dataEntry = contentResult.data[i]

				if (dataEntry.content.name === "Private") {
					expect(dataEntry.content.buckets).to.be.empty
					handled = true
				} else if (dataEntry.content.name === "Trusted Friend") {
					expect(dataEntry.content.buckets).to.include(trustedFriendsBucketId)
					expect(dataEntry.content.buckets).to.not.include(friendsBucketId)
					expect(dataEntry.content.buckets.length).to.eq(1)
					handled = true
				} else if (dataEntry.content.name === "Friend") {
					expect(dataEntry.content.buckets).to.include(trustedFriendsBucketId)
					expect(dataEntry.content.buckets).to.include(friendsBucketId)
					expect(dataEntry.content.buckets.length).to.eq(2)
					handled = true
				}

				expect(handled).to.eq(true)
			}
		} else {
			assert(false, "Test type access received a non-array")
		}
	}

	mocha.test("Test members access", async () => {
		await testMigrationAccess(`v1/members/${acc_legacy.id}`)
	})

	mocha.test("Test groups access", async () => {
		await testMigrationAccess(`v1/groups/${acc_legacy.id}`)
	})

	mocha.test("Test customFronts access", async () => {
		await testMigrationAccess(`v1/customFronts/${acc_legacy.id}`)
	})

	mocha.test("Test Custom Fields access", async () => {
		await testMigrationAccess(`v1/customFields/${acc_legacy.id}`)
	})
})
