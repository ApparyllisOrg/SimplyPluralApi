import assert from "assert";
import axios from "axios";
import * as mocha from "mocha"
import { validatefrontHistoryPostSchema, validateGetfrontHistorychema, validatefrontHistoryPatchSchema } from "../../api/v1/frontHistory";
import { getTestAxiosUrl, getTestToken } from "../utils";

describe("validate front history operations", () => {
	mocha.test("test getting of front history", async () => {
		await axios.get(getTestAxiosUrl("v1/frontHistory?endTime=0&startTime=0"), { headers: { authorization: getTestToken()} })
	});

	mocha.test("Test adding a front history entry to live", async () => {
		const member = await (await axios.post(getTestAxiosUrl("v1/member"), {name : "foo"}, { headers: { authorization: getTestToken()} })).data
		await axios.post(getTestAxiosUrl("v1/frontHistory"), {custom: false, live: true, startTime: 0, member: member}, { headers: { authorization: getTestToken()} })
	});

	mocha.test("Test removing front entry from live", async () => {
		const fronters : any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken()} })).data
		console.log(fronters)
		assert(fronters.length == 1, "Ensure one entry is in the database")
		await axios.patch(getTestAxiosUrl(`v1/frontHistory/${fronters[0].id}`), {live: false, endTime: 1000}, { headers: { authorization: getTestToken()} })
	});
});