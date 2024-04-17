import assert from "assert";
import axios from "axios";
import * as mocha from "mocha";
import { getTestAxiosUrl, getTestToken } from "../utils";

describe("validate front history operations", () => {
	mocha.test("test getting of front history", async () => {
		await axios.get(getTestAxiosUrl("v1/frontHistory?endTime=0&startTime=0"), { headers: { authorization: getTestToken() } });
	});

	mocha.test("Test adding a front history entry to live", async () => {
		const member = await (await axios.post(getTestAxiosUrl("v1/member"), { name: "foo", private: false, preventTrusted: false }, { headers: { authorization: getTestToken() } })).data;
		await axios.post(getTestAxiosUrl("v1/frontHistory"), { custom: false, live: true, startTime: 0, member: member }, { headers: { authorization: getTestToken() } });
	});

	mocha.test("Test removing front entry from live", async () => {
		const fronters: any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken() } })).data;
		assert(fronters.length == 1, "Ensure one entry is in the database");
		await axios.patch(getTestAxiosUrl(`v1/frontHistory/${fronters[0].id}`), { live: false, endTime: 1000 }, { headers: { authorization: getTestToken() } });
		const newfronters: any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken() } })).data;
		assert(newfronters.length == 0, "Ensure no entry is in the database");
	});

	mocha.test("Test adding a front entry and changing the active member and removing from front", async () => {
		const firstMember = await (await axios.post(getTestAxiosUrl("v1/member"), { name: "foo", private: false, preventTrusted: false }, { headers: { authorization: getTestToken() } })).data;
		const secondMember = await (await axios.post(getTestAxiosUrl("v1/member"), { name: "bar", private: false, preventTrusted: false }, { headers: { authorization: getTestToken() } })).data;

		await axios.post(getTestAxiosUrl("v1/frontHistory"), { custom: false, live: true, startTime: 0, member: firstMember }, { headers: { authorization: getTestToken() } });

		const fronters: any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken() } })).data;

		assert(fronters.length == 1, "Ensure one entry is in the database");

		await axios.patch(getTestAxiosUrl(`v1/frontHistory/${fronters[0].id}`), { member: secondMember }, { headers: { authorization: getTestToken() } });

		const newFronters: any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken() } })).data;

		assert(newFronters.length == 1, "Ensure one entry is in the database");
		assert(newFronters[0].content.member === secondMember, "Ensure the entry updated to the new member");

		await axios.patch(getTestAxiosUrl(`v1/frontHistory/${newFronters[0].id}`), { live: false, endTime: 1000 }, { headers: { authorization: getTestToken() } });

		const finalFronters: any[] = (await axios.get(getTestAxiosUrl("v1/fronters"), { headers: { authorization: getTestToken() } })).data;

		assert(finalFronters.length == 0, "Ensure no one is fronting");
	});

	mocha.test("Test we have a front history of previous tests", async () => {
		const entries: any[] = (await axios.get(getTestAxiosUrl("v1/frontHistory?endTime=1000&startTime=0"), { headers: { authorization: getTestToken() } })).data;
		assert(entries.length == 2, "Ensure we have all 2 ended front entries");
	});
});
