import axios from "axios"
import { assert, expect } from "chai"
import { decode } from "jsonwebtoken"
import { getCollection } from "../../../modules/mongo"
import { containsWhere, getIdWhere, getTestAxiosUrl, postDocument } from "../../utils"
import * as mocha from "mocha"
import moment from "moment"
import { ObjectId } from "mongodb"

export type AccountState = { id: string; token: string }

export const registerAccount = async (accountNumber: number, account: AccountState, version?: number): Promise<AccountState> => {
	const password = "APasswordTh3tFitsTh3Regexp!"
	const email = `test-access-${accountNumber}@apparyllis.com`

	const payload = version !== undefined ? { email, password, version } : { email, password }

	const result = await axios.post(getTestAxiosUrl("v1/auth/register"), payload)
	assert(result.data)

	account.token = result.data.access
	const jwtPayload = decode(result.data.access, { json: true })

	account.id = jwtPayload!.sub!

	const firstAcc = await getCollection("accounts").findOne({ email })
	assert(firstAcc)

	accountNumber++

	return account
}

export const testNoTypeAccess = async (url: string, singleUrl: string, token: string, fullAccessToken: string, expectCode: number = 403): Promise<void> => {
	const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })

	expect(contentResult.status).to.eq(403, contentResult.data)

	if (Array.isArray(contentResult.data)) {
		expect(contentResult.data.length).to.eq(0, `${url} -> Expected an empty array but received data`)
	}

	{
		// fullAccessToken has full access, get the member ids from acc1_legacy and tried to fetch with current test account
		const passingContentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: fullAccessToken }, validateStatus: () => true })

		expect(passingContentResult.status).to.eq(200, passingContentResult.data)

		if (Array.isArray(passingContentResult.data)) {
			for (let i = 0; i < passingContentResult.data.length; ++i) {
				const typeId = passingContentResult.data[i].id

				const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${typeId}`), { headers: { authorization: token }, validateStatus: () => true })
				expect(singleContentResult.status).to.eq(expectCode, JSON.stringify(singleContentResult.data))
			}
		} else {
			assert(false, "Test no type access received a non-array")
		}
	}
}

export const testCustomFieldsMemberAccess = async (url: string, singleUrl: string, fieldsUrl: string, token: string, expectedMembers: number): Promise<void> => {
	const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })

	expect(contentResult.status).to.eq(200, contentResult.data)

	const fieldsResult = await axios.get(getTestAxiosUrl(fieldsUrl), { headers: { authorization: token }, validateStatus: () => true })

	expect(fieldsResult.status).to.eq(200, fieldsResult.data)

	if (Array.isArray(contentResult.data)) {
		expect(contentResult.data.length).to.eq(expectedMembers, `${url} -> Test type access received an array but array length is mismatched`)

		for (let i = 0; i < expectedMembers; ++i) {
			const member = contentResult.data[i].content
			const memberInfo = member.info

			for (let x = 0; x < fieldsResult.data.length; ++x) {
				expect(memberInfo[fieldsResult.data[x].id]).not.to.be.undefined
			}

			const id = contentResult.data[i].id

			const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${id}`), { headers: { authorization: token }, validateStatus: () => true })

			expect(singleContentResult.status).to.eq(200, singleContentResult.data)

			for (let x = 0; x < fieldsResult.data.length; ++x) {
				expect(singleContentResult.data.content.info[fieldsResult.data[x].id]).not.to.be.undefined
			}
		}
	} else {
		assert(false, "Test type access received a non-array")
	}
}
export const testTypeAccess = async (url: string, singleUrl: string, token: string, expectedNames: string[], skipSingleCheck?: boolean): Promise<void> => {
	const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true })

	expect(contentResult.status).to.eq(200, contentResult.data)

	if (Array.isArray(contentResult.data)) {
		expect(contentResult.data.length).to.eq(expectedNames.length, `${url} -> Test type access received an array but array length is mismatched`)

		for (let i = 0; i < expectedNames.length; ++i) {
			const name = expectedNames[i]
			const foundName = containsWhere(contentResult.data, (doc) => doc.name === name)
			expect(foundName).to.eq(true, `${url} -> Test type access received but values mismatch. Tried to find ${name}`)
			if (foundName) {
				if (skipSingleCheck !== true) {
					const typeId = getIdWhere(contentResult.data, (doc) => doc.name === name)

					const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${typeId}`), { headers: { authorization: token }, validateStatus: () => true })

					expect(singleContentResult.status).to.eq(200, singleContentResult.data)
					expect(singleContentResult.data.content.name).to.eq(name, "Tried to get single content but name mismatched")
				}
			}
		}
	} else {
		assert(false, "Test type access received a non-array")
	}
}

export const testFrontAccess = async (uid: string, token: string, expectedFrontingNum: number, expectFrontString: string, expectCustomFrontString: string): Promise<void> => {
	{
		const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFront`), { headers: { authorization: token }, validateStatus: () => true })

		expect(frontResult.status).to.eq(200, frontResult.data)

		const fronters = frontResult.data.fronters
		if (Array.isArray(fronters)) {
			expect(fronters.length).to.eq(expectedFrontingNum, `${uid} -> Fronters fronters access received an array but array length is mismatched`)
		} else {
			assert(false, "Test type access received a non-array")
		}
	}

	{
		const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFrontValue`), { headers: { authorization: token }, validateStatus: () => true })

		expect(frontResult.status).to.eq(200, frontResult.data)
		expect(frontResult.data.frontString).to.eq(expectFrontString, "Expected front string is wrong")
		expect(frontResult.data.customFrontString).to.eq(expectCustomFrontString, "Expected custom front string is wrong")
	}
}

export const testNoFrontAccess = async (uid: string, token: string): Promise<void> => {
	{
		const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFront`), { headers: { authorization: token }, validateStatus: () => true })
		expect(frontResult.status).to.eq(403, frontResult.data)
	}

	{
		const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFrontValue`), { headers: { authorization: token }, validateStatus: () => true })
		expect(frontResult.status).to.eq(403, frontResult.data)
	}
}

export const setupFront = async (id: string, token: string) => {
	{
		const passingContentResult = await axios.get(getTestAxiosUrl(`v1/members/${id}`), { headers: { authorization: token }, validateStatus: () => true })

		expect(passingContentResult.status).to.eq(200, passingContentResult.data)

		if (Array.isArray(passingContentResult.data)) {
			expect(passingContentResult.data.length).to.eq(3, "Number of members when trying to setup front status is incorrect")

			for (let i = 0; i < passingContentResult.data.length; ++i) {
				const typeId = passingContentResult.data[i].id
				const postfrontEntry = await axios.post(
					getTestAxiosUrl(`v1/frontHistory`),
					{ custom: false, live: true, startTime: moment.now(), member: typeId },
					{ headers: { authorization: token }, validateStatus: () => true }
				)
				expect(postfrontEntry.status).to.eq(200, postfrontEntry.data)
			}
		}
	}

	{
		const passingContentResult = await axios.get(getTestAxiosUrl(`v1/customFronts/${id}`), { headers: { authorization: token }, validateStatus: () => true })

		expect(passingContentResult.status).to.eq(200, passingContentResult.data)

		if (Array.isArray(passingContentResult.data)) {
			expect(passingContentResult.data.length).to.eq(3, "Number of custom fronts when trying to setup front status is incorrect")

			for (let i = 0; i < passingContentResult.data.length; ++i) {
				const typeId = passingContentResult.data[i].id
				const postfrontEntry = await axios.post(
					getTestAxiosUrl(`v1/frontHistory`),
					{ custom: true, live: true, startTime: moment.now(), member: typeId },
					{ headers: { authorization: token }, validateStatus: () => true }
				)
				expect(postfrontEntry.status).to.eq(200, postfrontEntry.data)
			}
		}
	}
}
