import assert from "assert"
import axios, { AxiosResponse } from "axios"
import { decode } from "jsonwebtoken"
import * as mocha from "mocha"
import { getTestAxiosUrl, getTestToken } from "../../utils"
import { expect } from "chai"
describe("validate validation types", () => {
	mocha
		.test("Test group no emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group 1 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "👩‍❤️‍💋‍👩", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group 2 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group 3 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group text characters", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "ABC", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group 2 emoji mix", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "A👩‍❤️‍💋‍👩", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test group 3 emoji mix", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/group"),
				{ name: "Test", desc: "Test", parent: "root", emoji: "AB👩‍❤️‍💋‍👩", members: [], color: "" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket no emoji", async () => {
			const result = await axios.post(getTestAxiosUrl("v1/privacyBucket"), { name: "Test", desc: "Test", icon: "", color: "", rank: "0|aaaaaa:" }, { headers: { authorization: getTestToken() } })
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket 1 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "👩‍❤️‍💋‍👩", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket 2 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket 3 emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩👩‍❤️‍💋‍👩", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket text emoji", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "ABC", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket 2 emoji mix", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "A👩‍❤️‍💋‍👩", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)

	mocha
		.test("Test bucket 3 emoji mix", async () => {
			const result = await axios.post(
				getTestAxiosUrl("v1/privacyBucket"),
				{ name: "Test", desc: "Test", icon: "AB👩‍❤️‍💋‍👩", color: "", rank: "0|aaaaaa:" },
				{ headers: { authorization: getTestToken() } }
			)
			expect(result.status).to.eq(200)
		})
		.timeout(4000)
})
