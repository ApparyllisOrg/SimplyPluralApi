import axios from "axios"
import * as mocha from "mocha"
import { expect } from "chai"
import moment from "moment"
import { randomBytes } from "crypto"
import { getCollection } from "../../modules/mongo"
import { getTestAxiosUrl } from "../utils"
import { AccountState, registerAccount } from "../utils/authUtils"

describe("Validate export endpoints", () => {
	let acc: AccountState = { id: "", token: "" }

	mocha.before("Setup test account", async () => {
		acc = await registerAccount(acc)
		await getCollection("accounts").updateOne({ uid: acc.id }, { $set: { verified: true } })
	})

	describe("Export request (POST /v1/user/:id/export)", () => {
		mocha.before("Reset private user export timestamps", async () => {
			await getCollection("private").updateOne(
				{ uid: acc.id, _id: acc.id },
				{ $set: { lastExport: 0, lastExportAttempt: 0 } }
			)
		})

		mocha.test("Returns 200 and creates export records on first request", async () => {
			const result = await axios.post(
				getTestAxiosUrl(`v1/user/${acc.id}/export`),
				{},
				{ headers: { authorization: acc.token }, validateStatus: () => true }
			)
			expect(result.status, result.data).to.eq(200)
			expect(result.data.success).to.eq(true)

			const dataExport = await getCollection("dataExports").findOne({ uid: acc.id })
			expect(dataExport).to.not.be.null
			expect(dataExport!.exp).to.be.greaterThan(moment.now())

			const avatarExport = await getCollection("avatarExports").findOne({ uid: acc.id })
			expect(avatarExport).to.not.be.null
			expect(avatarExport!.exp).to.be.greaterThan(moment.now())
		})

		mocha.test("Returns 429 when attempted too recently (< 5 minutes)", async () => {
			const result = await axios.post(
				getTestAxiosUrl(`v1/user/${acc.id}/export`),
				{},
				{ headers: { authorization: acc.token }, validateStatus: () => true }
			)
			expect(result.status, result.data).to.eq(429)
		})

		mocha.test("Returns 403 when already exported within the last 24 hours", async () => {
			// Push lastExportAttempt past the 5-minute cooldown but keep lastExport within 24h
			await getCollection("private").updateOne(
				{ uid: acc.id, _id: acc.id },
				{
					$set: {
						lastExportAttempt: moment.now() - 1000 * 60 * 6,
						lastExport: moment.now() - 1000 * 60 * 60,
					},
				}
			)

			const result = await axios.post(
				getTestAxiosUrl(`v1/user/${acc.id}/export`),
				{},
				{ headers: { authorization: acc.token }, validateStatus: () => true }
			)
			expect(result.status, result.data).to.eq(403)
		})

		mocha.test("Returns 200 when last export was more than 24 hours ago", async () => {
			await getCollection("private").updateOne(
				{ uid: acc.id, _id: acc.id },
				{
					$set: {
						lastExportAttempt: moment.now() - 1000 * 60 * 6,
						lastExport: moment.now() - 1000 * 60 * 60 * 25,
					},
				}
			)

			const result = await axios.post(
				getTestAxiosUrl(`v1/user/${acc.id}/export`),
				{},
				{ headers: { authorization: acc.token }, validateStatus: () => true }
			)
			expect(result.status, result.data).to.eq(200)
			expect(result.data.success).to.eq(true)
		})
	})

	describe("Data export download (GET /v1/user/export/data)", () => {
		let validKey = ""

		mocha.before("Insert a fresh data export record", async () => {
			validKey = randomBytes(128).toString("hex")
			const exp = moment.now() + 1000 * 60 * 60 * 24
			await getCollection("dataExports").insertOne({ uid: acc.id, key: validKey, exp, downloads: 0, lastDownload: 0 })
		})

		mocha.test("Returns 400 for an unknown key", async () => {
			const unknownKey = randomBytes(128).toString("hex")
			const result = await axios.get(getTestAxiosUrl("v1/user/export/data"), {
				params: { uid: acc.id, key: unknownKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(400)
		})

		mocha.test("Returns 400 for an expired key", async () => {
			const expiredKey = randomBytes(128).toString("hex")
			const pastExp = moment.now() - 1000 * 60 * 60
			await getCollection("dataExports").insertOne({ uid: acc.id, key: expiredKey, exp: pastExp, downloads: 0, lastDownload: 0 })

			const result = await axios.get(getTestAxiosUrl("v1/user/export/data"), {
				params: { uid: acc.id, key: expiredKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(400)
		})

		mocha.test("Returns 200 with JSON content for a valid key", async () => {
			const result = await axios.get(getTestAxiosUrl("v1/user/export/data"), {
				params: { uid: acc.id, key: validKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(200)
			expect(result.headers["content-type"]).to.include("application/json")
		})

		mocha.test("Increments the download counter after a successful download", async () => {
			const exportDoc = await getCollection("dataExports").findOne({ uid: acc.id, key: validKey })
			expect(exportDoc!.downloads).to.eq(1)
		})

		mocha.test("Returns 429 when downloaded too recently (< 5 minutes)", async () => {
			const result = await axios.get(getTestAxiosUrl("v1/user/export/data"), {
				params: { uid: acc.id, key: validKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(429)
		})

		mocha.test("Returns 429 when the download limit (3) is reached", async () => {
			await getCollection("dataExports").updateOne(
				{ uid: acc.id, key: validKey },
				{ $set: { downloads: 3, lastDownload: 0 } }
			)

			const result = await axios.get(getTestAxiosUrl("v1/user/export/data"), {
				params: { uid: acc.id, key: validKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(429)
		})
	})

	describe("Avatar export download (GET /v1/user/export/avatars)", () => {
		let validKey = ""

		mocha.before("Insert a fresh avatar export record", async () => {
			validKey = randomBytes(128).toString("hex")
			const exp = moment.now() + 1000 * 60 * 60 * 24
			await getCollection("avatarExports").insertOne({ uid: acc.id, key: validKey, exp, downloads: 0, lastDownload: 0 })
		})

		mocha.test("Returns 400 for an unknown key", async () => {
			const unknownKey = randomBytes(128).toString("hex")
			const result = await axios.get(getTestAxiosUrl("v1/user/export/avatars"), {
				params: { uid: acc.id, key: unknownKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(400)
		})

		mocha.test("Returns 400 for an expired key", async () => {
			const expiredKey = randomBytes(128).toString("hex")
			const pastExp = moment.now() - 1000 * 60 * 60
			await getCollection("avatarExports").insertOne({ uid: acc.id, key: expiredKey, exp: pastExp, downloads: 0, lastDownload: 0 })

			const result = await axios.get(getTestAxiosUrl("v1/user/export/avatars"), {
				params: { uid: acc.id, key: expiredKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(400)
		})

		mocha.test("Returns 200 with ZIP content for a valid key", async () => {
			const result = await axios.get(getTestAxiosUrl("v1/user/export/avatars"), {
				params: { uid: acc.id, key: validKey },
				responseType: "arraybuffer",
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(200)
			expect(result.headers["content-type"]).to.include("application/zip")
		})

		mocha.test("Increments the download counter after a successful download", async () => {
			const exportDoc = await getCollection("avatarExports").findOne({ uid: acc.id, key: validKey })
			expect(exportDoc!.downloads).to.eq(1)
		})

		mocha.test("Returns 429 when downloaded too recently (< 5 minutes)", async () => {
			const result = await axios.get(getTestAxiosUrl("v1/user/export/avatars"), {
				params: { uid: acc.id, key: validKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(429)
		})

		mocha.test("Returns 429 when the download limit (3) is reached", async () => {
			await getCollection("avatarExports").updateOne(
				{ uid: acc.id, key: validKey },
				{ $set: { downloads: 3, lastDownload: 0 } }
			)

			const result = await axios.get(getTestAxiosUrl("v1/user/export/avatars"), {
				params: { uid: acc.id, key: validKey },
				validateStatus: () => true,
			})
			expect(result.status, result.data).to.eq(429)
		})
	})
})
