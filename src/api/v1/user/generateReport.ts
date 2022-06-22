// Using Tailwind CSS.
const md = require('markdown-it')({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true
});
import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import xss from "xss";
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
		avatar = "https://apparyllis.com/wp-content/uploads/2021/03/Apparylls_Image.png";
	}

	return avatar;
}

// ISO 8601 https://stackoverflow.com/questions/12756159/regex-and-iso8601-formatted-datetime
const re = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/
const getMoment = (timestamp: string | undefined, func: (timestamp: string) => string) => {
	if (timestamp && timestamp.length > 0) {

		if (!re.test(timestamp))
		{
		return "Invalid data"
		}

		return xss(func(timestamp));
	}
	return undefined;
}

const getColor = (colorStr: string | undefined) => {
	if (colorStr && colorStr.length > 0) {
		if (RegExp("^((#[a-fA-F0-9]{6})|(#[a-fA-F0-9]{8})|([a-fA-F0-9]{6})|([a-fA-F0-9]{8}))$").test(colorStr)) {
			return `<div class="h-5 rounded" style="background-color: ${xss(colorStr)};"></div>`;
		}
		return undefined
	}
	return undefined;
}

const stringFromField = (string: string, useMd: boolean): string | undefined => useMd? md.render(xss(string)) : xss(string)
const colorFromField = (string: string, useMd: boolean): string | undefined => getColor(string)
const dateFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do YYYY"))
const monthFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("MMMM"))
const yearFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("YYYY"))
const monthYearFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("MMMM YYYY"))
const timestampFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do YYYY, h:mm:ss a"))
const monthDayFromField = (string: string, useMd: boolean): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do"))

const typeConverters = [stringFromField, colorFromField, dateFromField, monthFromField, yearFromField, monthYearFromField, timestampFromField, monthDayFromField]

const getDescription = (data: any, template: string, useMd: boolean): string => {
	let result = `${template}`;
	if (data.desc) {
		result = result.replace("{{desc}}", useMd ? md.render(xss(data.desc)) : xss(data.desc));
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

	result = result.replace("{{username}}", xss(user.username));
	result = result.replace("{{color}}", xss(user.color));
	result = result.replace("{{avatar}}", xss(getAvatarString(user, uid)));
	result = result.replace("{{desc}}", getDescription(user, descTemplate, user.supportDescMarkdown ?? true));

	const members = await getCollection("members").find({ uid: uid }).toArray();
	members.sort((a, b) => {
		const aName: string = a.name ?? "";
		const bName: string = b.name ?? "";
		const aLowerName: string = aName.toLocaleLowerCase().normalize();
		const bLowerName: string = bName.toLocaleLowerCase().normalize();

		return aLowerName < bLowerName ? -1 : 1;
	});

	if (query.members) {
		let membersList = await getFile("./templates/members/reportMembers.html", "utf-8");

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

			member = member.replace("{{name}}", xss(memberData.name));
			member = member.replace("{{pronouns}}", xss(memberData.pronouns ?? ""));
			member = member.replace("{{color}}", xss(memberData.color));
			member = member.replace("{{avatar}}", xss(getAvatarString(memberData, uid)));
			member = member.replace("{{privacy}}", xss(getWrittenPrivacyLevel(memberData)));
			member = member.replace("{{desc}}", getDescription(memberData, descTemplate, memberData.supportDescMarkdown ?? true));

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

							const fieldInfo = user.fields[key];

							// Skip invalid fields
							if (!fieldInfo) {
								continue;
							}

							if (!meetsPrivacyLevel(fieldInfo, query.members.privacyLevel)) {
								continue;
							}

							const fieldResult = typeConverters[fieldInfo.type](value as string, user.fields.supportMarkdown ?? true);
							if (fieldResult) {
								let field = `${fieldTemplate}`;
								field = field.replace("{{key}}", xss(fieldKeyToName(key, user)));
								field = field.replace("{{value}}", fieldResult);
								generatedFields = generatedFields + field;
							}
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

	const customFronts = await getCollection("frontStatuses").find({ uid: uid }).toArray();
	customFronts.sort((a, b) => {
		const aName: string = a.name ?? "";
		const bName: string = b.name ?? "";
		const aLowerName: string = aName.toLocaleLowerCase().normalize();
		const bLowerName: string = bName.toLocaleLowerCase().normalize();

		return aLowerName < bLowerName ? -1 : 1;
	});

	if (query.customFronts) {
		let customFrontsList = await getFile("./templates/customFronts/reportCustomFronts.html", "utf-8");
		const fieldTemplate = await getFile("./templates/customFronts/reportCustomFront.html", "utf-8");
		let customFrontCountTemplate = await getFile("./templates/customFronts/reportCustomFrontCount.html", "utf-8");


		let generatedFronts = "";
		let numFrontsShown = 0;
		customFronts.forEach((frontData: any) => {

			if (!meetsPrivacyLevel(frontData, query.customFronts.privacyLevel)) {
				return;
			}

			let customFront = `${fieldTemplate}`;

			numFrontsShown++;

			customFront = customFront.replace("{{name}}", xss(frontData.name));
			customFront = customFront.replace("{{color}}", xss(frontData.color));
			customFront = customFront.replace("{{avatar}}", xss(getAvatarString(frontData, uid)));
			customFront = customFront.replace("{{privacy}}", xss(getWrittenPrivacyLevel(frontData)));
			customFront = customFront.replace("{{desc}}", getDescription(frontData, descTemplate, frontData.supportDescMarkdown ?? true));

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

		const liveFronters = await getCollection("frontHistory").find({ "live": true, uid }).sort({ "startTime": -1 }).toArray();

		let frontEntries = "";

		const addEntry = (value: any) => {
			const documentId = value.member;
			const foundMember: number = query.frontHistory.includeMembers ? members.findIndex((value) => value._id == documentId) : -1;
			let name = "";
			let avatar = "";
			if (foundMember == -1) {
				if (query.frontHistory.includeCustomFronts !== true)
				{
					return;
				}

				const foundFront: number = customFronts.findIndex((value) => value._id == documentId);
				if (foundFront == -1) {
					return;
				}
				if (!meetsPrivacyLevel(customFronts[foundFront], query.frontHistory.privacyLevel)) {
					return;
				}
				name = xss(customFronts[foundFront].name);
				avatar = xss(getAvatarString(customFronts[foundFront], uid));
			}
			else {
				if (!meetsPrivacyLevel(members[foundMember], query.frontHistory.privacyLevel)) {
					return;
				}
				name = xss(members[foundMember].name);
				avatar = xss(getAvatarString(members[foundMember], uid));
			}

			let frontEntry = `${frontHistoryTemplate}`;
			frontEntry = frontEntry.replace("{{name}}", xss(name));
			frontEntry = frontEntry.replace("{{avatar}}", xss(avatar));

			frontEntry = frontEntry.replace("{{start}}", xss(moment(value.startTime).format("dddd, MMMM Do YYYY, h:mm:ss a")));

			const status = value.customStatus;
			if (status) {
				frontEntry = frontEntry.replace("{{customStatus}}", xss(`Status: ${status}`));
			}
			else {
				frontEntry = frontEntry.replace("{{customStatus}}", ``);
			}

			if (value.live === true) {
				frontEntry = frontEntry.replace("{{end}}", "Active front");
				frontEntry = frontEntry.replace("{{duration}}", xss(moment.duration(moment.now() - value.startTime).humanize()));
			}
			else {
				frontEntry = frontEntry.replace("{{end}}", xss(moment(value.endTime).format("dddd, MMMM Do YYYY, h:mm:ss a")));
				frontEntry = frontEntry.replace("{{duration}}", xss(moment.duration(value.endTime - value.startTime).humanize()));
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