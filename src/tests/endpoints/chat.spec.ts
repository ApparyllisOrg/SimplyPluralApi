import assert from "assert";
import axios from "axios";
import * as mocha from "mocha";
import { getTestAxiosUrl, getTestToken, getTestUID } from "../utils";
import { expect } from "chai";
import { getCollection } from "../../modules/mongo";
import { createDataExportForUser } from "../../api/v1/user/export";

describe("validate chat export decryption", () => {
    let createdTestChannel : string = "";
    let createdTestMember : string = "";

    let firstCreatedMessage : string = "";
    let secondCreatedMessage : string = "";
    let thirdCreatedMessage : string = "";

    const FirstMessage = "Hello World!";
    const SecondMessage = "Hello World 2!";
    const ThirdMessage = "Hello World 3!";

	mocha.test("Create test channel", async () => {
		createdTestChannel = (await axios.post(getTestAxiosUrl("v1/chat/channel"), { name: "Export Test", desc: ""}, { headers: { authorization: getTestToken() } })).data;
	});

    mocha.test("Create test member", async () => {
		createdTestMember = (await axios.post(getTestAxiosUrl("v1/member"), { name: "Export Test Member", desc: ""}, { headers: { authorization: getTestToken() } })).data;
	});

	mocha.test("Create chat messages", async () => {
		firstCreatedMessage = (await axios.post(getTestAxiosUrl("v1/chat/message"), { message: FirstMessage, channel: createdTestChannel, writer: createdTestMember, writtenAt: Date.now() }, { headers: { authorization: getTestToken() } }));
		secondCreatedMessage = (await axios.post(getTestAxiosUrl("v1/chat/message"), { message: SecondMessage, channel: createdTestChannel, writer: createdTestMember, writtenAt: Date.now() }, { headers: { authorization: getTestToken() } }));
		thirdCreatedMessage = (await axios.post(getTestAxiosUrl("v1/chat/message"), { message: ThirdMessage, channel: createdTestChannel, writer: createdTestMember, writtenAt: Date.now() }, { headers: { authorization: getTestToken() } }));
    });

    mocha.test("Validate export data", async () => {
		const exportData = await createDataExportForUser(getTestUID());

        expect(exportData).not.be.null
        expect(exportData.chatMessages).not.be.null
        expect(exportData.chatMessages).not.be.undefined

        let foundFirstMessage = false;
        let foundSecondMessage = false;
        let foundThirdMessage = false;

        const messages = exportData.chatMessages;
        for (let i = 0; i < messages.length; ++i)
        {
            const message = messages[i]
            if (message.message == FirstMessage)
            {
                foundFirstMessage = true;
                expect(message.writer).equals(createdTestMember)
                expect(message.channel).equals(createdTestChannel)
            }
            else if (message.message == SecondMessage)
            {
                foundSecondMessage = true;
                expect(message.writer).equals(createdTestMember)
                expect(message.channel).equals(createdTestChannel)
            }
            else if (message.message == ThirdMessage)
            {
                foundThirdMessage = true;
                expect(message.writer).equals(createdTestMember)
                expect(message.channel).equals(createdTestChannel)
            }
        }

        expect(foundFirstMessage).true
        expect(foundSecondMessage).true
        expect(foundThirdMessage).true
    });
});
