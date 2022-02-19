// Using Tailwind CSS.

import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import { getCollection } from "../../../modules/mongo";
import { queryObject } from "../../../modules/mongo/baseTypes";

const fieldKeyToName = (key: string, userData: any) => {
	return userData.fields[key].name;
}

const meetsPrivacyLevel = (data: any, level: number): boolean => {

	if (level == 0) {
		return true;
	}

	if (level == 1) {
		return !data.private || (data.private && !data.preventTrusted);
	}

	if (level == 2) {
		return !data.private && !data.preventTrusted;
	}

	return false;
}

const getWrittenPrivacyLevel = (data: any): string => {
	let level = "All friends";
	if (data.private) {
		level = "Trusted friends";
	}
	if (data.private && data.preventTrusted) {
		level = "Private";
	}
	return level;
}

const getAvatarString = (data: any, uid: string): string => {
	let avatar = "";
	if (data.avatarUuid) {
		avatar = `https://spaces.apparyllis.com/avatars/${uid}/${data.avatarUuid}`;
	}
	else if (data.avatarUrl) {
		avatar = data.avatarUrl;
	}

	if (avatar.length == 0) {
		// Todo: Make this a better link
		avatar = "https://sfo3.digitaloceanspaces.com/simply-plural/content/resources/Logo_Apparyllis_Square_1024.png";
	}

	return avatar;
}

const getDescription = (data: any, template: string): string => {
	let result = `${template}`;
	if (data.desc) {
		result = result.replace("{{desc}}", data.desc);
		return result;
	}

	return "";
}

export const generateUserReport = async (query: { [key: string]: any }, uid: string) => {

	const user = await getCollection("users").findOne({ uid });

	const getFile = promisify(readFile);
	const getFileResult = await getFile("./templates/reportTemplate.html", "utf-8");
	const descTemplate = await getFile("./templates/reportDescription.html", "utf-8");
	let result = getFileResult;

	result = result.replace("{{username}}", user.username);
	result = result.replace("{{color}}", user.color);
	result = result.replace("{{avatar}}", getAvatarString(user, uid));
	result = result.replace("{{desc}}", getDescription(user, descTemplate));

	if (query.members) {
		let membersList = await getFile("./templates/members/reportMembers.html", "utf-8");

		const members = await getCollection("members").find({ uid: uid }).sort({ "name": 1 }).toArray();

		const memberTemplate = await getFile("./templates/members/reportMember.html", "utf-8");
		const fieldsTemplate = await getFile("./templates/members/reportCustomFields.html", "utf-8");
		const fieldTemplate = await getFile("./templates/members/reportCustomField.html", "utf-8");
		let memberCountTemplate = await getFile("./templates/members/reportMemberCount.html", "utf-8");
		let generatedMembers = "";
		let numMembersShown = 0;

		members.forEach((memberData: any) => {

			if (!meetsPrivacyLevel(memberData, query.members.privacyLevel)) {
				return;
			}

			let member = `${memberTemplate}`;

			numMembersShown++;

			member = member.replace("{{name}}", memberData.name);
			member = member.replace("{{pronouns}}", memberData.pronouns);
			member = member.replace("{{color}}", memberData.color);
			member = member.replace("{{avatar}}", getAvatarString(memberData, uid));
			member = member.replace("{{privacy}}", getWrittenPrivacyLevel(memberData));
			member = member.replace("{{desc}}", getDescription(memberData, descTemplate));

			if (query.members.includeCustomFields === false) {
				member = member.replace("{{fields}}", "");
			}
			else {
				if (memberData.info) {

					let fields = `${fieldsTemplate}`;
					let generatedFields = "";
					for (const [key, value] of Object.entries(memberData.info)) {
						const strValue: string = value as string;
						if (value && strValue.length > 0) {

							// Skip invalid fields
							if (!user.fields[key]) {
								continue;
							}

							if (!meetsPrivacyLevel(user.fields[key], query.members.privacyLevel)) {
								continue;
							}

							let field = `${fieldTemplate}`;
							field = field.replace("{{key}}", fieldKeyToName(key, user));
							field = field.replace("{{value}}", value as string);
							generatedFields = generatedFields + field;


						}
					}

					if (generatedFields.length > 0) {
						fields = fields.replace("{{fields}}", generatedFields);
						member = member + fields;
					}
				}
			}

			generatedMembers = generatedMembers + member;
		})

		membersList = membersList.replace("{{members}}", generatedMembers);
		result = result.replace("{{members}}", membersList);

		memberCountTemplate = memberCountTemplate.replace("{{amount}}", numMembersShown.toString());
		result = result.replace("{{numMembers}}", memberCountTemplate);
	}
	else {
		result = result.replace("{{numMembers}}", "");
		result = result.replace("{{members}}", "");
	}


	if (query.customFronts) {
		let customFrontsList = await getFile("./templates/customFronts/reportCustomFronts.html", "utf-8");
		const fieldTemplate = await getFile("./templates/customFronts/reportCustomFront.html", "utf-8");
		let customFrontCountTemplate = await getFile("./templates/customFronts/reportCustomFrontCount.html", "utf-8");
		const customFronts = await getCollection("frontStatuses").find({ uid: uid }).sort({ "name": 1 }).toArray();

		let generatedFronts = "";
		let numFrontsShown = 0;
		customFronts.forEach((frontData: any) => {

			if (!meetsPrivacyLevel(frontData, query.customFronts.privacyLevel)) {
				return;
			}

			let customFront = `${fieldTemplate}`;

			numFrontsShown++;

			customFront = customFront.replace("{{name}}", frontData.name);
			customFront = customFront.replace("{{color}}", frontData.color);
			customFront = customFront.replace("{{avatar}}", getAvatarString(frontData, uid));
			customFront = customFront.replace("{{privacy}}", getWrittenPrivacyLevel(frontData));
			customFront = customFront.replace("{{desc}}", getDescription(frontData, descTemplate));

			generatedFronts = generatedFronts + customFront;
		})

		customFrontsList = customFrontsList.replace("{{customFronts}}", generatedFronts)
		result = result.replace("{{customFronts}}", customFrontsList);

		customFrontCountTemplate = customFrontCountTemplate.replace("{{amount}}", numFrontsShown.toString());
		result = result.replace("{{numCustomFronts}}", customFrontCountTemplate);
	}
	else {
		result = result.replace("{{numCustomFronts}}", "");
		result = result.replace("{{customFronts}}", "");
	}


	if (query.frontHistory) {
		class frontHistoryQuery implements queryObject {
			uid!: string;
			startTime: any;
			endTime: any;
		}

		let frontHistory = await getFile("./templates/frontHistory/reportFrontHistory.html", "utf-8");
		const frontHistoryTemplate = await getFile("./templates/frontHistory/reportFrontHistoryEntry.html", "utf-8");

		const searchQuery: frontHistoryQuery = { uid: uid, startTime: { $gte: query.frontHistory.start }, endTime: { $lte: query.frontHistory.end } }
		const history = await getCollection("frontHistory").find(searchQuery).sort({ "startTime": -1 }).toArray();
		const members = await getCollection("members").find({ uid: uid }).sort({ "name": 1 }).toArray();
		const customFronts = await getCollection("frontStatuses").find({ uid: uid }).sort({ "name": 1 }).toArray();

		const liveFronters = await getCollection("frontHistory").find({ "live": true }).sort({ "startTime": -1 }).toArray();

		let frontEntries = "";

		const addEntry = (value: any) => {
			const documentId = value.member;
			const foundMember: number = members.findIndex((value) => value._id == documentId);
			let name = "";
			let avatar = "";
			if (foundMember == -1) {
				const foundFront: number = customFronts.findIndex((value) => value._id == documentId);
				if (foundFront == -1) {
					return;
				}
				if (!meetsPrivacyLevel(customFronts[foundFront], query.frontHistory.privacyLevel)) {
					return;
				}
				name = customFronts[foundFront].name;
				avatar = getAvatarString(customFronts[foundFront], uid);
			}
			else {
				if (!meetsPrivacyLevel(members[foundMember], query.frontHistory.privacyLevel)) {
					return;
				}
				name = members[foundMember].name;
				avatar = getAvatarString(members[foundMember], uid);
			}

			let frontEntry = `${frontHistoryTemplate}`;
			frontEntry = frontEntry.replace("{{name}}", name);
			frontEntry = frontEntry.replace("{{avatar}}", avatar);

			frontEntry = frontEntry.replace("{{start}}", moment(value.startTime).format("dddd, MMMM Do YYYY, h:mm:ss a"));

			const status = value.customStatus;
			if (status) {
				frontEntry = frontEntry.replace("{{customStatus}}", `Status: ${status}`);
			}
			else {
				frontEntry = frontEntry.replace("{{customStatus}}", ``);
			}

			if (value.live === true) {
				frontEntry = frontEntry.replace("{{end}}", "Active front");
				frontEntry = frontEntry.replace("{{duration}}", moment.duration(moment.now() - value.startTime).humanize());
			}
			else {
				frontEntry = frontEntry.replace("{{end}}", moment(value.endTime).format("dddd, MMMM Do YYYY, h:mm:ss a"));
				frontEntry = frontEntry.replace("{{duration}}", moment.duration(value.endTime - value.startTime).humanize());
			}

			frontEntries = frontEntries + frontEntry;
		}

		liveFronters.forEach((value) => {
			addEntry(value);
		});

		history.forEach((value) => {
			addEntry(value);
		});

		frontHistory = frontHistory.replace("{{entries}}", frontEntries);
		result = result.replace("{{frontHistory}}", frontHistory);
	}
	else {
		result = result.replace("{{frontHistory}}", "");
	}

	return result;
}