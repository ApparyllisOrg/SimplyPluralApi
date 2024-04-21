// Using Tailwind CSS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const md = require("markdown-it")({
	html: true,
	linkify: true,
	breaks: true,
	typographer: true,
});
import { readFile } from "fs";
import moment from "moment";
import { promisify } from "util";
import xss from "xss";
import { getCollection } from "../../../modules/mongo";
import { queryObject } from "../../../modules/mongo/baseTypes";

export const fieldKeyToName = (key: string, userData: any) => {
	return userData.fields[key].name;
};

export const getAvatarString = (data: any, uid: string): string => {
	let avatar = "";
	if (data.avatarUuid) {
		avatar = `https://spaces.apparyllis.com/avatars/${uid}/${data.avatarUuid}`;
	} else if (data.avatarUrl) {
		avatar = data.avatarUrl;
	}

	if (avatar.length == 0) {
		// Todo: Make this a better link
		avatar = "https://apparyllis.com/wp-content/uploads/2021/03/Apparylls_Image.png";
	}

	return avatar;
};

// ISO 8601 https://stackoverflow.com/questions/12756159/regex-and-iso8601-formatted-datetime
export const re = /^([+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([.,]\d+(?!:))?)?(\17[0-5]\d([.,]\d+)?)?([zZ]|([+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
export const getMoment = (timestamp: string | undefined, func: (timestamp: string) => string) => {
	if (timestamp && timestamp.length > 0) {
		if (!re.test(timestamp)) {
			return "";
		}

		return xss(func(timestamp));
	}
	return undefined;
};

export const getColor = (colorStr: string | undefined) => {
	if (colorStr && colorStr.length > 0) {
		if (RegExp("^((#[a-fA-F0-9]{6})|(#[a-fA-F0-9]{8})|([a-fA-F0-9]{6})|([a-fA-F0-9]{8}))$").test(colorStr)) {
			return `<div class="h-5 rounded" style="background-color: ${xss(colorStr)};"></div>`;
		}
		return undefined;
	}
	return undefined;
};

export const stringFromField = (string: string, useMd: boolean): string | undefined => (useMd ? md.render(xss(string)) : xss(string));
export const colorFromField = (string: string): string | undefined => getColor(string);
export const dateFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do YYYY"));
export const monthFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("MMMM"));
export const yearFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("YYYY"));
export const monthYearFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("MMMM YYYY"));
export const timestampFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do YYYY, h:mm:ss a"));
export const monthDayFromField = (string: string): string | undefined => getMoment(string, (str) => moment(str).format("dddd, MMMM Do"));

export const typeConverters = [stringFromField, colorFromField, dateFromField, monthFromField, yearFromField, monthYearFromField, timestampFromField, monthDayFromField];

export const getDescription = (data: any, template: string, useMd: boolean): string => {
	let result = `${template}`;
	if (data.desc) {
		result = result.replace("{{desc}}", useMd ? md.render(xss(data.desc)) : xss(data.desc));
		return result;
	}

	return "";
};

export const setupReport = async (user: any) => 
{
    const getFile = promisify(readFile);
	const getFileResult = await getFile("./templates/reportTemplate.html", "utf-8");
	const descTemplate = await getFile("./templates/reportDescription.html", "utf-8");
	let result = getFileResult;

	result = result.replace("{{username}}", xss(user.username));
	result = result.replace("{{color}}", xss(user.color));
	result = result.replace("{{avatar}}", xss(getAvatarString(user, user.uid)));
	result = result.replace("{{desc}}", getDescription(user, descTemplate, user.supportDescMarkdown ?? true));

    return result
}

export const generateUserReport = async (query: { [key: string]: any }, uid: string, 
    createMember: (query: { [key: string]: any }, template: string, member: any) => Promise<{ show: boolean, result: string}>,
    createCustomFront: (query: { [key: string]: any }, template: string, customFront: any) => Promise<{ show: boolean, result: string}>,
    shouldShowFrontEntry: (query: { [key: string]: any }, member: any, isMember: boolean) =>{ show: boolean } ) => {

	const user = await getCollection("users").findOne({ uid });
    
    const getFile = promisify(readFile);

	let result = await setupReport(user);

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
		let memberCountTemplate = await getFile("./templates/members/reportMemberCount.html", "utf-8");
		let generatedMembers = "";
		let numMembersShown = 0;

        for (let i = 0; i < members.length; ++i)
        {
            const memberData = members[i]
            let member = `${memberTemplate}`;

            const result = await createMember(query, member, memberData)
            if (result.show === true)
            {
                generatedMembers = generatedMembers + result.result
                numMembersShown++
            }       
        }

		membersList = membersList.replace("{{members}}", generatedMembers);
		result = result.replace("{{members}}", membersList);

		memberCountTemplate = memberCountTemplate.replace("{{amount}}", numMembersShown.toString());
		result = result.replace("{{numMembers}}", memberCountTemplate);
	} else {
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

        for (let i = 0; i < customFronts.length; ++i)
        {
            const frontData = customFronts[i]
            let customFront = `${fieldTemplate}`;

            const result = await createCustomFront(query, customFront, frontData)
            if (result.show === true)
            {
                generatedFronts = generatedFronts + result.result
                numFrontsShown++
            }       
        }

		customFrontsList = customFrontsList.replace("{{customFronts}}", generatedFronts);
		result = result.replace("{{customFronts}}", customFrontsList);

		customFrontCountTemplate = customFrontCountTemplate.replace("{{amount}}", numFrontsShown.toString());
		result = result.replace("{{numCustomFronts}}", customFrontCountTemplate);
	} else {
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

		const searchQuery: frontHistoryQuery = { uid: uid, startTime: { $gte: query.frontHistory.start }, endTime: { $lte: query.frontHistory.end } };
		const history = await getCollection("frontHistory").find(searchQuery).sort({ startTime: -1 }).toArray();

		const liveFronters = await getCollection("frontHistory").find({ live: true, uid }).sort({ startTime: -1 }).toArray();

		let frontEntries = "";

		const addEntry = (value: any) => {
			const documentId = value.member;
			const foundMember: number = query.frontHistory.includeMembers ? members.findIndex((value) => value._id == documentId) : -1;
			let name = "";
			let avatar = "";
			if (foundMember == -1) {
				if (query.frontHistory.includeCustomFronts !== true) {
					return;
				}

				const foundFront: number = customFronts.findIndex((value) => value._id == documentId);
				if (foundFront == -1) {
					return;
				}

                const showResult = shouldShowFrontEntry(query, customFronts[foundFront], false)
                if (showResult.show === false)
                {
                    return;
                }

				name = xss(customFronts[foundFront].name);
				avatar = xss(getAvatarString(customFronts[foundFront], uid));
			} else {
                const showResult = shouldShowFrontEntry(query, members[foundMember], true)
                if (showResult.show === false)
                {
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
			} else {
				frontEntry = frontEntry.replace("{{customStatus}}", ``);
			}

			if (value.live === true) {
				frontEntry = frontEntry.replace("{{end}}", "Active front");
				frontEntry = frontEntry.replace("{{duration}}", xss(moment.duration(moment.now() - value.startTime).humanize()));
			} else {
				frontEntry = frontEntry.replace("{{end}}", xss(moment(value.endTime).format("dddd, MMMM Do YYYY, h:mm:ss a")));
				frontEntry = frontEntry.replace("{{duration}}", xss(moment.duration(value.endTime - value.startTime).humanize()));
			}

			frontEntries = frontEntries + frontEntry;
		};

		liveFronters.forEach((value) => {
			addEntry(value);
		});

		history.forEach((value) => {
			addEntry(value);
		});

		frontHistory = frontHistory.replace("{{entries}}", frontEntries);
		result = result.replace("{{frontHistory}}", frontHistory);
	} else {
		result = result.replace("{{frontHistory}}", "");
	}

	return result;
};
