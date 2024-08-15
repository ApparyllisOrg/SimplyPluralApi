import assert from "assert"
import * as mocha from "mocha"
import { getCollection } from "../../modules/mongo"
import { containsWhereDirect, getTestAxiosUrl, postDocument, sleep } from "../utils"
import { expect } from "chai"
import axios from "axios"
import { FIELD_MIGRATION_VERSION } from "../../api/v1/user/updates/updateUser"
import { AccountState, registerAccount, setupFront, testCustomFieldsMemberAccess, testFrontAccess, testNoFrontAccess, testNoTypeAccess, testTypeAccess } from "./access/utils"
import { ObjectId } from "mongodb"

describe("validate legacy access across accounts", () => {
	let acc1_legacy: AccountState = { id: "", token: "" } // Legacy Account sharing data
	let acc2_legacy: AccountState = { id: "", token: "" } // Legacy Account marked as friend to acc1_legacy
	let acc3_legacy: AccountState = { id: "", token: "" } // Legacy Account marked as trusted friend to acc1_legacy
	let acc4_legacy: AccountState = { id: "", token: "" } // Legacy Account marked as friend to acc1_legacy but cannot see front
	let acc5_legacy: AccountState = { id: "", token: "" } // Legacy Account marked as trusted friend to acc1_legacy but cannot see front
	let acc6_legacy: AccountState = { id: "", token: "" } // Legacy Account given no access
	let acc7_legacy: AccountState = { id: "", token: "" } // Legacy Account not a friend

	mocha.test("Setup legacy test accounts", async () => {
		// Register sharing account
		acc1_legacy = await registerAccount(13, acc1_legacy)

		// Register legacy accounts
		acc2_legacy = await registerAccount(7, acc2_legacy)
		acc3_legacy = await registerAccount(8, acc3_legacy)
		acc4_legacy = await registerAccount(9, acc4_legacy)
		acc5_legacy = await registerAccount(10, acc5_legacy)
		acc6_legacy = await registerAccount(11, acc6_legacy)
		acc7_legacy = await registerAccount(12, acc7_legacy)

		await getCollection("private").updateMany(
			{ uid: { $in: [acc1_legacy.id, acc2_legacy.id, acc3_legacy.id, acc4_legacy.id, acc5_legacy.id, acc6_legacy.id, acc7_legacy.id] } },
			{ $set: { latestVersion: FIELD_MIGRATION_VERSION - 1 } }
		)
	})

	mocha.test("Befriend legacy test accounts", async () => {
		// Send friend requests
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/add/${acc2_legacy.id}`),
				{ settings: { seeMembers: true, seeFront: true, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc1_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/add/${acc3_legacy.id}`),
				{ settings: { seeMembers: true, seeFront: true, getFrontNotif: false, trusted: true } },
				{ headers: { authorization: acc1_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/add/${acc4_legacy.id}`),
				{ settings: { seeMembers: true, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc1_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/add/${acc5_legacy.id}`),
				{ settings: { seeMembers: true, seeFront: false, getFrontNotif: false, trusted: true } },
				{ headers: { authorization: acc1_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/add/${acc6_legacy.id}`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc1_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		// Accept friend requests
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc2_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc3_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc4_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc5_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false } },
				{ headers: { authorization: acc6_legacy.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		// Sleep for Friends LRU Cache to be invalidated
		await sleep(10000)
	})

	mocha.test("Setup legacy custom fields access", async () => {
		await getCollection("users").updateOne(
			{ uid: acc1_legacy.id },
			{
				$set: {
					fields: {
						privateField: {
							name: "Private Name",
							order: 0,
							private: true,
							preventTrusted: true,
							type: 0,
							supportMarkdown: false,
						},
						trustedFriendField: {
							name: "Trusted Friend Name",
							order: 1,
							private: true,
							preventTrusted: false,
							type: 0,
							supportMarkdown: false,
						},
						friendField: {
							name: "Friend Name",
							order: 2,
							private: false,
							preventTrusted: false,
							type: 0,
							supportMarkdown: false,
						},
					},
				},
			}
		)
	})

	const setupTypeAccess = async (type: string, url: string, insertObj: any): Promise<void> => {
		let acc1PrivateType: ObjectId | string | null
		let acc1TrustedFriendType: ObjectId | string | null
		let acc1FriendType: ObjectId | string | null

		const getPostData = (obj: any, staticData: { name: string; private?: boolean | undefined; preventTrusted?: boolean | undefined }) => {
			return Object.assign(obj, staticData)
		}

		acc1PrivateType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, { name: "Private", private: true, preventTrusted: true }))).id
		acc1TrustedFriendType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, { name: "Trusted Friend", private: true, preventTrusted: false }))).id
		acc1FriendType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, { name: "Friend", private: false, preventTrusted: false }))).id

		expect(acc1PrivateType, `Create Private ${type}`)
		expect(acc1TrustedFriendType, `Create "Trusted Friend ${type}`)
		expect(acc1FriendType, `Create Friend ${type}`)
	}

	mocha.test("Setup legacy members access", async () => {
		await setupTypeAccess("members", "v1/member", {
			info: {
				privateField: "Private Data",
				trustedFriendField: "Trusted Friend Data",
				friendField: "Friend Data",
			},
		})
	})

	mocha.test("Setup legacy groups access", async () => {
		await setupTypeAccess("groups", "v1/group", { desc: "", color: "", parent: "", emoji: "", members: [] })
	})

	mocha.test("Setup legacy custom fronts access", async () => {
		await setupTypeAccess("frontStatuses", "v1/customFront", {})
	})

	mocha.test("Test legacy members access", async () => {
		await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc2_legacy.token, ["Friend"])
		await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc3_legacy.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc4_legacy.token, ["Friend"])
		await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc5_legacy.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc6_legacy.token, acc3_legacy.token)
		await testNoTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc7_legacy.token, acc3_legacy.token)
	})

	mocha.test("Test legacy groups access", async () => {
		await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc2_legacy.token, ["Friend"])
		await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc3_legacy.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc4_legacy.token, ["Friend"])
		await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc5_legacy.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc6_legacy.token, acc3_legacy.token)
		await testNoTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc7_legacy.token, acc3_legacy.token)
	})

	mocha.test("Test legacy custom fronts access", async () => {
		await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc2_legacy.token, ["Friend"])
		await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc3_legacy.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc4_legacy.token, ["Friend"])
		await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc5_legacy.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc6_legacy.token, acc3_legacy.token)
		await testNoTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc7_legacy.token, acc3_legacy.token)
	})

	const testCustomFieldAccess = async (url: string, userUrl: string, token: string, expectedNumMembers: number, expectedData: { data: string; id: string }[]) => {
		{
			const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })

			expect(contentResult.status).to.eq(200, contentResult.data)

			if (Array.isArray(contentResult.data)) {
				expect(contentResult.data.length).to.eq(expectedNumMembers, `${url} -> Test custom field access received an array but array length is mismatched`)

				for (let i = 0; i < expectedNumMembers; ++i) {
					const member = contentResult.data[i]

					const memberInfo = member.content.info

					const memberInfoKeys = Object.keys(memberInfo)
					expect(memberInfoKeys.length).to.eq(expectedData.length, `${url} -> Test custom field info access received mismatched amount of fields`)

					for (let i = 0; i < memberInfoKeys.length; ++i) {
						containsWhereDirect(expectedData, (data) => data.id === memberInfoKeys[i])

						const memberInfoEntry = memberInfo[memberInfoKeys[i]]
						containsWhereDirect(expectedData, (data) => data.name === memberInfoEntry)
					}
				}
			} else {
				assert(false, "Test custom field access received a non-array")
			}
		}

		{
			const userResult = await axios.get(getTestAxiosUrl(userUrl), { headers: { authorization: token }, validateStatus: () => true })

			expect(userResult.status).to.eq(200, userResult.data)

			const fields = userResult.data.content.fields

			const infoFields = Object.keys(fields)
			expect(infoFields.length).to.eq(expectedData.length, `${url} -> Test custom field info received mismatched amount of fields`)

			for (let i = 0; i < infoFields.length; ++i) {
				containsWhereDirect(expectedData, (data) => data.id === infoFields[i])

				const fieldEntry = fields[infoFields[i]]
				containsWhereDirect(expectedData, (data) => data.name === fieldEntry.name)
			}
		}
	}

	const testNoCustomFieldAccess = async (url: string, token: string) => {
		{
			const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })
			expect(contentResult.status).to.eq(403, contentResult.data)
		}
	}

	mocha.test("Test legacy custom fields access", async () => {
		await testCustomFieldAccess(`v1/members/${acc1_legacy.id}`, `v1/user/${acc1_legacy.id}`, acc2_legacy.token, 1, [{ id: "friendField", data: "Friend Data" }])
		await testCustomFieldAccess(`v1/members/${acc1_legacy.id}`, `v1/user/${acc1_legacy.id}`, acc3_legacy.token, 2, [
			{ id: "friendField", data: "Friend Data" },
			{ id: "trustedFriendField", data: "Trusted Friend Data" },
		])
		await testCustomFieldAccess(`v1/members/${acc1_legacy.id}`, `v1/user/${acc1_legacy.id}`, acc4_legacy.token, 1, [{ id: "friendField", data: "Friend Data" }])
		await testCustomFieldAccess(`v1/members/${acc1_legacy.id}`, `v1/user/${acc1_legacy.id}`, acc5_legacy.token, 2, [
			{ id: "friendField", data: "Friend Data" },
			{ id: "trustedFriendField", data: "Trusted Friend Data" },
		])

		await testCustomFieldsMemberAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, `v1/customFields/${acc1_legacy.id}`, acc2_legacy.token, 1)
		await testCustomFieldsMemberAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, `v1/customFields/${acc1_legacy.id}`, acc3_legacy.token, 2)
		await testCustomFieldsMemberAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, `v1/customFields/${acc1_legacy.id}`, acc4_legacy.token, 1)
		await testCustomFieldsMemberAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, `v1/customFields/${acc1_legacy.id}`, acc5_legacy.token, 2)

		{
			const userResult = await axios.get(getTestAxiosUrl(`v1/user/${acc1_legacy.id}`), { headers: { authorization: acc6_legacy.token }, validateStatus: () => true })
			expect(userResult.status).to.eq(200, userResult.data)

			const fields = userResult.data.content.fields

			const memberInfoFields = Object.keys(fields)
			expect(memberInfoFields.length).to.eq(0, `v1/user/${acc1_legacy.id} -> Test custom field info no access received mismatched amount of fields`)
		}

		{
			const userResult = await axios.get(getTestAxiosUrl(`v1/user/${acc1_legacy.id}`), { headers: { authorization: acc7_legacy.token }, validateStatus: () => true })
			expect(userResult.status).to.eq(403, userResult.data)
		}

		await testNoCustomFieldAccess(`v1/members/${acc1_legacy.id}`, acc6_legacy.token)
		await testNoCustomFieldAccess(`v1/members/${acc1_legacy.id}`, acc7_legacy.token)
	})

	mocha.test("Setup front", async () => {
		await setupFront(acc1_legacy.id, acc1_legacy.token)
	})

	mocha.test("Test legacyfront access", async () => {
		// Expect member and custom front fronting
		await testFrontAccess(acc1_legacy.id, acc2_legacy.token, 2, "Friend", "Friend")

		// Expect member and custom front fronting, both friend and trusted friend members
		await testFrontAccess(acc1_legacy.id, acc3_legacy.token, 4, "Friend, Trusted Friend", "Friend, Trusted Friend")

		// Expect no access to fronters
		await testNoFrontAccess(acc1_legacy.id, acc4_legacy.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1_legacy.id, acc5_legacy.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1_legacy.id, acc6_legacy.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1_legacy.id, acc7_legacy.token)
	})
})
