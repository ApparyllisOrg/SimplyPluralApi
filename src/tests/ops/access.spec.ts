import assert from "assert"
import * as mocha from "mocha"
import { containsWhere, containsWhereDirect, getIdWhere, getTestAxiosUrl, postDocument } from "../utils"
import { ObjectId } from "mongodb"
import { expect } from "chai"
import axios from "axios"
import moment from "moment"
import { notifyFrontDue } from "../../modules/events/frontChange"
import { AccountState, registerAccount, setupFront, testCustomFieldsMemberAccess, testFriendAccess, testFrontAccess, testNoFrontAccess, testNoTypeAccess, testTypeAccess } from "./access/utils"
import { getCollection } from "../../modules/mongo"

describe("validate access across accounts", () => {
	let acc1: AccountState = { id: "", token: "" } // Account sharing data

	let acc2: AccountState = { id: "", token: "" } // Account marked as friend to acc1
	let acc3: AccountState = { id: "", token: "" } // Account marked as trusted friend to acc1
	let acc4: AccountState = { id: "", token: "" } // Account marked as friend to acc1 but cannot see front
	let acc5: AccountState = { id: "", token: "" } // Account marked as trusted friend to acc1 but cannot see front
	let acc6: AccountState = { id: "", token: "" } // Account given no access
	let acc7: AccountState = { id: "", token: "" } // Account not a friend

	mocha.test("Setup test accounts", async () => {
		// Register sharing account
		acc1 = await registerAccount(0, acc1, 300)

		// Register new accounts
		acc2 = await registerAccount(1, acc2, 300)
		acc3 = await registerAccount(2, acc3, 300)
		acc4 = await registerAccount(3, acc4, 300)
		acc5 = await registerAccount(4, acc5, 300)
		acc6 = await registerAccount(5, acc6, 300)
		acc7 = await registerAccount(6, acc7, 300)
	})

	let acc1BucketFriends: ObjectId | undefined
	let acc1BucketTrustedFriends: ObjectId | undefined

	mocha.test("Befriend test accounts", async () => {
		// Send friend requests
		{
			const result = await axios.post(
				getTestAxiosUrl(`v2/friends/request/add/${acc2.id}`),
				{ settings: { seeMembers: true, seeFront: true, getFrontNotif: false } },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v2/friends/request/add/${acc3.id}`),
				{ settings: { seeMembers: true, seeFront: true, getFrontNotif: false } },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v2/friends/request/add/${acc4.id}`),
				{ settings: { seeMembers: true, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v2/friends/request/add/${acc5.id}`),
				{ settings: { seeMembers: true, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v2/friends/request/add/${acc6.id}`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		// Accept friend requests
		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc2.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc3.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc4.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc5.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}

		{
			const result = await axios.post(
				getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`),
				{ settings: { seeMembers: false, seeFront: false, getFrontNotif: false } },
				{ headers: { authorization: acc6.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200, result.data)
		}
	})

	mocha.test("Grant friends access", async () => {
		const buckets: any = (await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1.token } })).data

		acc1BucketFriends = getIdWhere(buckets, (doc) => doc.name === "Friends")
		acc1BucketTrustedFriends = getIdWhere(buckets, (doc) => doc.name === "Trusted friends")

		{
			const result = await axios.patch(
				getTestAxiosUrl("v1/privacyBucket/assignfriends"),
				{ bucket: acc1BucketFriends, friends: [acc2.id, acc3.id, acc4.id, acc5.id] },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200)
		}

		{
			const result = await axios.patch(
				getTestAxiosUrl("v1/privacyBucket/assignfriends"),
				{ bucket: acc1BucketTrustedFriends, friends: [acc3.id, acc5.id] },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200)
		}
	})

	const setupTypeAccess = async (type: string, url: string, insertObj: any): Promise<void> => {
		const bucketResult = await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1.token }, validateStatus: () => true })
		expect(bucketResult.status).to.eq(200)

		acc1BucketFriends = getIdWhere(bucketResult.data, (doc) => doc.name === "Friends")
		acc1BucketTrustedFriends = getIdWhere(bucketResult.data, (doc) => doc.name === "Trusted friends")

		expect(acc1BucketFriends, "Find friends bucket")
		expect(acc1BucketFriends, "Find trusted friends bucket")

		let acc1PrivateType: ObjectId | string | null
		let acc1TrustedFriendType: ObjectId | string | null
		let acc1FriendType: ObjectId | string | null

		const getPostData = (obj: any, staticData: { name: string }) => {
			return Object.assign(obj, staticData)
		}

		acc1PrivateType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, { name: "Private" }))).id
		acc1TrustedFriendType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, { name: "Trusted Friend" }))).id
		acc1FriendType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, { name: "Friend" }))).id

		expect(acc1PrivateType, `Create Private ${type}`)
		expect(acc1TrustedFriendType, `Create "Trusted Friend ${type}`)
		expect(acc1FriendType, `Create Friend ${type}`)

		{
			const result = await axios.patch(
				getTestAxiosUrl("v1/privacyBucket/setbuckets"),
				{ id: acc1FriendType, buckets: [acc1BucketFriends], type },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200)
		}

		{
			const result = await axios.patch(
				getTestAxiosUrl("v1/privacyBucket/setbuckets"),
				{ id: acc1TrustedFriendType, buckets: [acc1BucketTrustedFriends], type },
				{ headers: { authorization: acc1.token }, validateStatus: () => true }
			)
			expect(result.status).to.eq(200)
		}
	}

	mocha.test("Setup groups access", async () => {
		await setupTypeAccess("groups", "v1/group", { desc: "", color: "", parent: "", emoji: "", members: [] })
	})

	mocha.test("Setup custom fronts access", async () => {
		await setupTypeAccess("frontStatuses", "v1/customFront", {})
	})

	mocha.test("Setup custom fields access", async () => {
		await setupTypeAccess("customFields", "v1/customField", { supportMarkdown: false, type: 0, order: "0|aaaaaa:" })
	})

	mocha.test("Setup members access", async () => {
		const acc1Fields = await getCollection("customFields").find({ uid: acc1.id }).toArray()

		const infoObject: { [key: string]: string } = {}

		acc1Fields.forEach((field) => {
			infoObject[field._id.toString()] = "SomeText"
		})

		await setupTypeAccess("members", "v1/member", { info: infoObject })
	})

	mocha.test("Setup front", async () => {
		setupFront(acc1.id, acc1.token)
	})

	mocha.test("Test members access", async () => {
		await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc2.token, ["Friend"])
		await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc3.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc4.token, ["Friend"])
		await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc5.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc6.token, acc3.token)
		await testNoTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc7.token, acc3.token)
	})

	mocha.test("Test groups access", async () => {
		await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc2.token, ["Friend"])
		await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc3.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc4.token, ["Friend"])
		await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc5.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc6.token, acc3.token)
		await testNoTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc7.token, acc3.token)
	})

	mocha.test("Test custom fronts access", async () => {
		await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc2.token, ["Friend"])
		await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc3.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc4.token, ["Friend"])
		await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc5.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc6.token, acc3.token)
		await testNoTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc7.token, acc3.token)
	})

	const testCustomFieldsUerAccess = async (url: string, token: string, expectedData: string[]) => {
		const userResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })

		expect(userResult.status).to.eq(200, userResult.data)

		const fields = userResult.data.content.fields

		const infoFields = Object.keys(fields)
		expect(infoFields.length).to.eq(expectedData.length, `${url} -> Test custom field info received mismatched amount of fields`)

		for (let i = 0; i < infoFields.length; ++i) {
			// Due to the runtime generated custom field ids we can't really test if the ID matches, however a name check can be done as they are stably named

			const fieldEntry = fields[infoFields[i]]
			containsWhereDirect(expectedData, (data) => data === fieldEntry.name)
		}
	}

	mocha.test("Test custom fields access", async () => {
		await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc2.token, ["Friend"])
		await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc3.token, ["Friend", "Trusted Friend"])
		await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc4.token, ["Friend"])
		await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc5.token, ["Friend", "Trusted Friend"])
		await testNoTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc6.token, acc3.token)
		await testNoTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc7.token, acc3.token)

		await testCustomFieldsUerAccess(`v1/user/${acc1.id}`, acc2.token, ["Friend"])
		await testCustomFieldsUerAccess(`v1/user/${acc1.id}`, acc3.token, ["Friend", "Trusted Friend"])
		await testCustomFieldsUerAccess(`v1/user/${acc1.id}`, acc4.token, ["Friend"])
		await testCustomFieldsUerAccess(`v1/user/${acc1.id}`, acc5.token, ["Friend", "Trusted Friend"])

		await testCustomFieldsMemberAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, `v1/customFields/${acc1.id}`, acc2.token, 1)
		await testCustomFieldsMemberAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, `v1/customFields/${acc1.id}`, acc3.token, 2)
		await testCustomFieldsMemberAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, `v1/customFields/${acc1.id}`, acc4.token, 1)
		await testCustomFieldsMemberAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, `v1/customFields/${acc1.id}`, acc5.token, 2)

		await testFriendAccess(`v1/friends`, acc1.id, acc2.token, ["Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc3.token, ["Friend", "Trusted Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc4.token, ["Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc5.token, ["Friend", "Trusted Friend"])

		{
			const userResult = await axios.get(getTestAxiosUrl(`v1/user/${acc1.id}`), { headers: { authorization: acc6.token }, validateStatus: () => true })
			expect(userResult.status).to.eq(200, userResult.data)

			const fields = userResult.data.content.fields

			const memberInfoFields = Object.keys(fields)
			expect(memberInfoFields.length).to.eq(0, `v1/user/${acc1.id} -> Test custom field info no access received mismatched amount of fields`)
		}

		{
			const userResult = await axios.get(getTestAxiosUrl(`v1/user/${acc1.id}`), { headers: { authorization: acc7.token }, validateStatus: () => true })
			expect(userResult.status).to.eq(403, userResult.data)
		}
	})

	mocha.test("Test friends access", async () => {
		await testFriendAccess(`v1/friends`, acc1.id, acc2.token, ["Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc3.token, ["Friend", "Trusted Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc4.token, ["Friend"])
		await testFriendAccess(`v1/friends`, acc1.id, acc5.token, ["Friend", "Trusted Friend"])
	})

	mocha.test("Test front access", async () => {
		// Trigger front due to set the front string
		await notifyFrontDue(acc1.id, "")

		// Expect member and custom front fronting
		await testFrontAccess(acc1.id, acc2.token, 2, "Friend", "Friend")

		// Expect member and custom front fronting, both friend and trusted friend members
		await testFrontAccess(acc1.id, acc3.token, 4, "Friend, Trusted Friend", "Friend, Trusted Friend")

		// Expect no access to fronters
		await testNoFrontAccess(acc1.id, acc4.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1.id, acc5.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1.id, acc6.token)

		// Expect no access to fronters
		await testNoFrontAccess(acc1.id, acc7.token)
	})
})
