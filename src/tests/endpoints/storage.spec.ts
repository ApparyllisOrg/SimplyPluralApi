import axios from "axios"
import * as mocha from "mocha"
import { getTestAxiosUrl } from "../utils"
import { AccountState, registerAccount } from "../utils/authUtils"
import { ONE_TWELVE } from "../../util/version"
import { getCollection, parseId } from "../../modules/mongo"
import { uuid } from "short-uuid"
import { expect } from "chai"

import sharp from "sharp"

const createPNG = async () => {
	const testImage = await sharp({
		create: {
			width: 16,
			height: 16,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0.5 },
		},
	})
		.png()
		.toBuffer()

	return Array.from(new Uint8Array(testImage))
}

describe("Validate storage endpoints", () => {
	let legacy_acc: AccountState = { id: "", token: "" }
	let acc: AccountState = { id: "", token: "" }
	let unverfied_acc: AccountState = { id: "", token: "" }

	mocha.before("Setup test accounts", async () => {
		legacy_acc = await registerAccount(legacy_acc, ONE_TWELVE - 1)
		acc = await registerAccount(acc, ONE_TWELVE)
		unverfied_acc = await registerAccount(unverfied_acc, ONE_TWELVE)

		await getCollection("accounts").updateOne({ uid: legacy_acc.id }, { $set: { verified: true } })
		await getCollection("accounts").updateOne({ uid: acc.id }, { $set: { verified: true } })
	})

	describe("Legacy account tests", async () => {
		const randuuid = uuid()

		mocha.test("Test upload", async () => {
			const image = await createPNG()

			const result = await axios.post(getTestAxiosUrl(`v1/avatar/${randuuid}`), { buffer: image }, { headers: { authorization: legacy_acc.token }, validateStatus: () => true })
			expect(result.status).to.eq(200)
		})

		mocha.test("Test delete", async () => {
			const result = await axios.delete(getTestAxiosUrl(`v1/avatar/${randuuid}`), { headers: { authorization: legacy_acc.token }, validateStatus: () => true })
			expect(result.status).to.eq(200)
		})
	})

	describe("Account tests", async () => {
		const randuuid = uuid().toString()

		let memberId: string | undefined
		let customFrontId: string | undefined

		mocha.before("Create test content", async () => {
			{
				const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)
				memberId = result.data
			}

			{
				const result = await axios.post(getTestAxiosUrl(`v1/customFront`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)
				customFrontId = result.data
			}
		})

		describe("Test old routes, expect failure", async () => {
			mocha.test("Test upload", async () => {
				const image = await createPNG()

				const result = await axios.post(getTestAxiosUrl(`v1/avatar/${randuuid}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(400)
			})

			mocha.test("Test delete", async () => {
				const result = await axios.delete(getTestAxiosUrl(`v1/avatar/${randuuid}`), { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(400)
			})
		})

		describe("Test new routes, expect success", async () => {
			describe("Test members", async () => {
				let firstAvatarUuid = ""

				mocha.test("Test upload", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/${memberId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const member = await getCollection("members").findOne({ uid: acc.id, _id: parseId(memberId!) })
					expect(member.avatarUuid).to.not.eq(undefined)
					expect(member.avatarUuid).to.eq(result.data.avatarUuid)

					firstAvatarUuid = member.avatarUuid
				})

				mocha.test("Test upload non-existing", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/foobar`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(404)
				})

				mocha.test("Test upload replacement", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/${memberId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const member = await getCollection("members").findOne({ uid: acc.id, _id: parseId(memberId!) })
					expect(member.avatarUuid).to.not.eq(undefined)
					expect(member.avatarUuid).to.not.eq(firstAvatarUuid)
					expect(member.avatarUuid).to.eq(result.data.avatarUuid)
				})

				mocha.test("Test delete", async () => {
					const result = await axios.delete(getTestAxiosUrl(`v2/avatar/member/${memberId}`), { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)
					expect(result.data).to.eq("Deleted avatar")

					const member = await getCollection("members").findOne({ uid: acc.id, _id: parseId(memberId!) })
					expect(member.avatarUuid).to.eq(undefined)
				})
			})

			describe("Test custom fronts", async () => {
				let firstAvatarUuid = ""

				mocha.test("Test upload", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/customFront/${customFrontId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const frontStatus = await getCollection("frontStatuses").findOne({ uid: acc.id, _id: parseId(customFrontId!) })
					expect(frontStatus.avatarUuid).to.not.eq(undefined)
					expect(frontStatus.avatarUuid).to.eq(result.data.avatarUuid)

					firstAvatarUuid = frontStatus.avatarUuid
				})

				mocha.test("Test upload non-existing", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/customFront/foobar`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(404)
				})

				mocha.test("Test upload replacement", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/customFront/${customFrontId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const frontStatus = await getCollection("frontStatuses").findOne({ uid: acc.id, _id: parseId(customFrontId!) })
					expect(frontStatus.avatarUuid).to.not.eq(undefined)
					expect(frontStatus.avatarUuid).to.not.eq(firstAvatarUuid)
					expect(frontStatus.avatarUuid).to.eq(result.data.avatarUuid)
				})

				mocha.test("Test delete", async () => {
					const result = await axios.delete(getTestAxiosUrl(`v2/avatar/customFront/${customFrontId}`), { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)
					expect(result.data).to.eq("Deleted avatar")

					const frontStatus = await getCollection("frontStatuses").findOne({ uid: acc.id, _id: parseId(customFrontId!) })
					expect(frontStatus.avatarUuid).to.eq(undefined)
				})
			})

			describe("Test user", async () => {
				let firstAvatarUuid = ""

				mocha.test("Test upload", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/user`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const user = await getCollection("users").findOne({ uid: acc.id, _id: acc.id })
					expect(user.avatarUuid).to.not.eq(undefined)
					expect(user.avatarUuid).to.eq(result.data.avatarUuid)

					firstAvatarUuid = user.avatarUuid
				})

				mocha.test("Test upload replacement", async () => {
					const image = await createPNG()

					const result = await axios.post(getTestAxiosUrl(`v2/avatar/user`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)

					const user = await getCollection("users").findOne({ uid: acc.id, _id: acc.id })
					expect(user.avatarUuid).to.not.eq(undefined)
					expect(user.avatarUuid).to.not.eq(firstAvatarUuid)
					expect(user.avatarUuid).to.eq(result.data.avatarUuid)
				})

				mocha.test("Test delete", async () => {
					const result = await axios.delete(getTestAxiosUrl(`v2/avatar/user`), { headers: { authorization: acc.token }, validateStatus: () => true })
					expect(result.status, result.data).to.eq(200)
					expect(result.data).to.eq("Deleted avatar")

					const user = await getCollection("users").findOne({ uid: acc.id, _id: acc.id })
					expect(user.avatarUuid).to.eq(undefined)
				})
			})

			describe("Test upload guards", async () => {
				let firstMemberId = ""
				let secondMemberId = ""

				mocha.before("Setup test members", async () => {
					{
						const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)
						firstMemberId = result.data

						await getCollection("members").updateOne({ uid: acc.id, _id: parseId(firstMemberId) }, { $set: { avatarUuid: "/../foo/foobar" } })
					}

					{
						const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)
						secondMemberId = result.data

						await getCollection("members").updateOne({ uid: acc.id, _id: parseId(secondMemberId) }, { $set: { avatarUuid: "/%2e%2e%2f/foo/foobar" } })
					}
				})

				mocha.test("Test upload replacement", async () => {
					const image = await createPNG()
					{
						const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/${firstMemberId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true, responseType: "text", transformResponse: [(v) => v] })
						expect(result.status, result.data).to.eq(200)
					}

					{
						const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/${secondMemberId}`), { buffer: image }, { headers: { authorization: acc.token }, validateStatus: () => true, responseType: "text", transformResponse: [(v) => v] })
						expect(result.status, result.data).to.eq(200)
					}
				})
			})

			describe("Test delete guards", async () => {
				let firstMemberId = ""
				let secondMemberId = ""

				mocha.before("Setup test members", async () => {
					{
						const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)
						firstMemberId = result.data

						await getCollection("members").updateOne({ uid: acc.id, _id: parseId(firstMemberId) }, { $set: { avatarUuid: "/../foo/foobar" } })
					}

					{
						const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)
						secondMemberId = result.data

						await getCollection("members").updateOne({ uid: acc.id, _id: parseId(secondMemberId) }, { $set: { avatarUuid: "/%2e%2e%2f/foo/foobar" } })
					}
				})

				mocha.test("Test delete", async () => {
					{
						const result = await axios.delete(getTestAxiosUrl(`v2/avatar/member/${firstMemberId}`), { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)

						const member = await getCollection("members").findOne({ uid: acc.id, _id: parseId(firstMemberId) })
						expect(member.avatarUuid).to.eq(undefined)
						expect(result.data).to.eq("Avatar field was unset, previous avatar could not be found")
					}

					{
						const result = await axios.delete(getTestAxiosUrl(`v2/avatar/member/${secondMemberId}`), { headers: { authorization: acc.token }, validateStatus: () => true })
						expect(result.status, result.data).to.eq(200)

						const member = await getCollection("members").findOne({ uid: acc.id, _id: parseId(secondMemberId) })
						expect(member.avatarUuid).to.eq(undefined)
						expect(result.data).to.eq("Avatar field was unset, previous avatar could not be found")
					}
				})
			})
		})

		describe("Test prevention of setting avatarUuid", async () => {
			mocha.test("Test member", async () => {
				await getCollection("members").updateOne({ uid: acc.id, _id: parseId(memberId!) }, { $set: { avatarUuid: "bar" } })

				const result = await axios.patch(getTestAxiosUrl(`v1/member/${memberId}`), { avatarUuid: "foo" }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)

				const dbResult = await getCollection("members").findOne({ uid: acc.id, _id: parseId(memberId!) })
				expect(dbResult.avatarUuid).to.eq("bar")
			})

			mocha.test("Test custom front", async () => {
				await getCollection("frontStatuses").updateOne({ uid: acc.id, _id: parseId(customFrontId!) }, { $set: { avatarUuid: "bar" } })

				const result = await axios.patch(getTestAxiosUrl(`v1/customFront/${customFrontId!}`), { avatarUuid: "foo" }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)

				const dbResult = await getCollection("frontStatuses").findOne({ uid: acc.id, _id: parseId(customFrontId!) })
				expect(dbResult.avatarUuid).to.eq("bar")
			})

			mocha.test("Test user", async () => {
				await getCollection("users").updateOne({ uid: acc.id, _id: acc.id }, { $set: { avatarUuid: "bar" } })

				const result = await axios.patch(getTestAxiosUrl(`v1/user/${acc.id}`), { avatarUuid: "foo" }, { headers: { authorization: acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)

				const dbResult = await getCollection("users").findOne({ uid: acc.id, _id: acc.id })
				expect(dbResult.avatarUuid).to.eq("bar")
			})
		})
	})

	describe("Unverified account tests", async () => {
		let memberId: string | undefined
		let customFrontId: string | undefined

		mocha.before("Create test content", async () => {
			{
				const result = await axios.post(getTestAxiosUrl(`v1/member`), { name: "Test" }, { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)
				memberId = result.data
			}

			{
				const result = await axios.post(getTestAxiosUrl(`v1/customFront`), { name: "Test" }, { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
				expect(result.status, result.data).to.eq(200)
				customFrontId = result.data
			}
		})

		mocha.test("Test deny upload", async () => {
			const image = await createPNG()

			const result = await axios.post(getTestAxiosUrl(`v1/avatar/${uuid()}`), { buffer: image }, { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
			expect(result.status).to.eq(403)
		})

		mocha.test("Test deny delete", async () => {
			const result = await axios.delete(getTestAxiosUrl(`v1/avatar/${uuid()}`), { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
			expect(result.status).to.eq(403)
		})

		mocha.test("Test deny upload member", async () => {
			const image = await createPNG()

			const result = await axios.post(getTestAxiosUrl(`v2/avatar/member/${memberId}`), { buffer: image }, { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
			expect(result.status, result.data).to.eq(403)
		})

		mocha.test("Test deny upload customFront", async () => {
			const image = await createPNG()

			const result = await axios.post(getTestAxiosUrl(`v2/avatar/customFront/${customFrontId}`), { buffer: image }, { headers: { authorization: unverfied_acc.token }, validateStatus: () => true })
			expect(result.status, result.data).to.eq(403)
		})
	})
})
