import assert from "assert";
import axios from "axios";
import { decode } from "jsonwebtoken";
import * as mocha from "mocha";
import { getCollection } from "../../modules/mongo";
import { getTestAxiosUrl, sleep } from "../utils";

describe("validate authentication flow", () => {
	const email = "test@apparyllis.com"
	const changedEmail = "test2@apparyllis.com"
	const password = "APasswordTh3tFitsTh3Regexp!";
	const changedPassword = "APasswordTh3tFitsTh3Regexp3ndCh3nged!";

	let userId = "";

	let accessToken = "";
	let refreshToken = "";
	let refreshToken2 = "";
	let refreshToken3 = "";

	mocha.test("Register a new user", async () => {
		const result = await axios.post(getTestAxiosUrl("v1/auth/register"), {email, password})
		assert(result.data)

		const jwt = decode(result.data.access, {json: true})

		userId = jwt!.sub!;

		const firstAcc = await getCollection("accounts").findOne({email: {$ne: null}})
		assert(firstAcc)
	});

	mocha.test("Login new user", async () => {
		const result = await axios.post(getTestAxiosUrl("v1/auth/login"), {email, password})
		assert(result.data.access)
		assert(result.data.refresh)

		accessToken = result.data.access;
		refreshToken = result.data.refresh;
	});

	mocha.test("Request new confirm email", async () => {
		const result = await axios.post(getTestAxiosUrl("v1/auth/verification/request"), {}, { headers: { authorization: accessToken} }).catch((reason) => { return reason.response })
		assert(result.status == 400, "It should return 400, as we are rate-locked to one per minute and registering sends an email")
	});

	mocha.test("Confirm email", async () => {
		const firstAcc = await getCollection("accounts").findOne({email: {$ne: null}})
		const result = await axios.get(getTestAxiosUrl(`v1/auth/verification/confirm?uid=${firstAcc.uid}&key=${firstAcc.verificationCode}`))
		assert(result.status == 200)
		const firstAccVerified = await getCollection("accounts").findOne({email: {$ne: null}})
		assert(firstAccVerified.verified === true)

		const secondResult = await axios.get(getTestAxiosUrl(`v1/auth/verification/confirm?uid=${firstAcc.uid}&key=${firstAcc.verificationCode}`)).catch((reason) => { return reason.response })
		assert(secondResult.status == 401, "Verifying twice should not be possible")
	});

	mocha.test("Refresh JWT tokens", async () => {
		const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: accessToken} }).catch((reason) => { return reason.response })
		assert(failResult.status == 401, "Refreshing with an access token is illegal!")

		// We need to sleep so that the jwt's from register and refresh won't be the same if iss and exp are identical for register and refresh
		await sleep(2000)

		const successResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken} }).catch((reason) => { return reason.response })
		assert(successResult.status == 200, "Refreshing with a refresh token should be functional")

		assert(successResult.data.access)
		assert(successResult.data.refresh)

		assert(successResult.data.access !== accessToken)
		assert(successResult.data.refresh !== refreshToken)

		const failResult2 = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: accessToken} }).catch((reason) => { return reason.response })
		assert(failResult2.status == 401, "Refreshing with a refresh token that was previously used, is illegal!")

		const successResult2 = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: successResult.data.refresh} }).catch((reason) => { return reason.response })
		assert(successResult2.status == 200, "Refreshing with the newly refresh token should be functional")
	}).timeout(4000);

	mocha.test("Request password reset", async () => {
		{
			const result = await axios.get(getTestAxiosUrl(`v1/auth/password/reset?email=${email}`)).catch((reason) => { return reason.response })
			assert(result.status == 200, "Request password reset")

			const user = await getCollection("accounts").findOne({email})
			assert(user.passwordResetToken, "Password reset token valid")
		}
	}).timeout(4000);

	mocha.test("Reset password from request", async () => {
		{
			const user = await getCollection("accounts").findOne({email})
			assert(user.passwordResetToken, "Password reset token valid")
			const result = await axios.post(getTestAxiosUrl("v1/auth/password/reset/change"), {resetKey: user.passwordResetToken, newPassword: password}).catch((reason) => { return reason.response })

			assert(result.status == 200, "Password reset")
			const updatedUser = await getCollection("accounts").findOne({email})
			assert(updatedUser.passwordResetToken, "Password reset token invalid")
		}
	}).timeout(4000);

	mocha.test("Change user password", async () => {
		{
			const result = await axios.post(getTestAxiosUrl(`v1/auth/password/change`), {oldPassword: password, uid: userId, newPassword: changedPassword}).catch((reason) => { return reason.response })
			refreshToken2 = result.data.refresh
			assert(result.status == 200, "change password")
		}

		{
			const result = await axios.post(getTestAxiosUrl("v1/auth/login"), {email, password: changedPassword}).catch((reason) => { return reason.response })
			assert(result.status == 200, "login")
		}

		{
			const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken} }).catch((reason) => { return reason.response })
			assert(failResult.status == 401, "Old refresh tokens should be discarded")
		}

		{
			const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken2} }).catch((reason) => { return reason.response })
			assert(failResult.status == 200, "New refresh token should work")
		}
	}).timeout(8000);

	mocha.test("Change user email", async () => {
		{
			const result = await axios.post(getTestAxiosUrl(`v1/auth/email/change`), {password: changedPassword, oldEmail: email, newEmail: changedEmail}).catch((reason) => { return reason.response })
			refreshToken3 = result.data.refresh
			assert(result.status == 200, "change email")
		}

		{
			const result = await axios.post(getTestAxiosUrl("v1/auth/login"), {email: changedEmail, password: changedPassword}).catch((reason) => { return reason.response })
			assert(result.status == 200, "login")
		}

		{
			const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken} }).catch((reason) => { return reason.response })
			assert(failResult.status == 401, "Old refresh token 1 should be discarded")
		}

		{
			const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken2} }).catch((reason) => { return reason.response })
			assert(failResult.status == 401, "Old refresh token 2 should be discarded")
		}

		{
			const failResult = await axios.get(getTestAxiosUrl("v1/auth/refresh"), { headers: { authorization: refreshToken3} }).catch((reason) => { return reason.response })
			assert(failResult.status == 200, "New refresh token should work")
		}
	}).timeout(4000);
})