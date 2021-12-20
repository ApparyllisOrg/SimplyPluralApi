import axios from "axios"
import { getCollection, parseId } from "../../mongo"

export interface syncOptions {
	name: boolean,
	avatar: boolean,
	pronouns: boolean,
	description: boolean,
	useDisplayName: boolean,
	color: boolean
}

export interface syncAllOptions {
	overwrite: boolean,
	add: boolean
}

// Simply Plural colors are supported in a wide variety.
// We officially support: #ffffff, ffffff, #ffffffff
const spColorToPkColor = (color: string): string | undefined => {
	if (color.length === 7) {
		return color.substring(0, 6);
	} else if (color.length === 9) {
		return color.substring(0, 6);
	} else if (color.length === 6) {
		return color;
	}

	return undefined;
}

const limitStringLength = (value: string | undefined, length: number) => {
	if (value) {
		if (value.length > length) {
			value = value.substring(0, length)
		}
	}
}

export const syncMemberToPk = async (options: syncOptions, spMemberId: string, token: string, userId: string): Promise<{ success: boolean, msg: string }> => {
	const spMemberResult = await getCollection("members").findOne({ uid: userId, _id: parseId(spMemberId) })

	if (spMemberResult && spMemberResult.pkId) {

		const { name, avatarUrl, pronouns, desc, color } = spMemberResult;

		limitStringLength(name, 100)
		limitStringLength(avatarUrl, 256)
		limitStringLength(pronouns, 100)
		limitStringLength(desc, 1000)

		const memberDataToSync: any = {}
		if (options.name) {
			if (options.useDisplayName) {
				memberDataToSync.display_name = name;
			} else {
				memberDataToSync.name = name;
			}
		}
		if (options.avatar) memberDataToSync.avatar_url = avatarUrl;
		if (options.pronouns) memberDataToSync.pronouns = pronouns;
		if (options.description) memberDataToSync.description = desc;
		if (options.color) {
			const updateColor = spColorToPkColor(color)
			if (updateColor) {
				memberDataToSync.color = updateColor;
			}
		}

		const pkMemberResult = await axios.get(`https://api.pluralkit.me/v2/${spMemberResult.pkId}`, { headers: { authorization: token } })
		if (pkMemberResult.status == 200) {

			const patchResult = await axios.patch(`https://api.pluralkit.me/v2/systems/@me`, memberDataToSync, { headers: { authorization: token } })
			if (patchResult.status === 200) {
				return { success: true, msg: "Member updated on Plural Kit" }
			}
			else {
				return { success: false, msg: `${patchResult.status.toString()} - ${patchResult.statusText}` }
			}
		}
		else if (pkMemberResult.status === 404) {

			const postResult = await axios.post(`https://api.pluralkit.me/v2/systems/@me`, memberDataToSync, { headers: { authorization: token } })
			if (postResult.status === 200) {
				return { success: true, msg: "Member added to Plural Kit" }
			}
			else {
				return { success: false, msg: `${postResult.status.toString()} - ${postResult.statusText}` }
			}
		}
		else {
			return { success: false, msg: `${pkMemberResult.status.toString()} - ${pkMemberResult.statusText}` }
		}
	}
	else {
		if (!spMemberResult.pkId) {
			return { success: false, msg: "Member does not have a pkId setup." }
		}
		else {
			return { success: false, msg: "Member does not exist in Simply Plural for this account." }
		}

	}
}

export const syncMemberFromPk = async (options: syncOptions, pkMemberId: string, token: string, userId: string): Promise<{ success: boolean, msg: string }> => {
	const pkMemberResult = await axios.get(`https://api.pluralkit.me/v2/${pkMemberId}`, { headers: { authorization: token } })

	if (pkMemberResult && pkMemberResult.status === 200) {

		const memberDataToSync: any = {}
		if (options.name) {
			if (options.useDisplayName) {
				memberDataToSync.name = pkMemberResult.data.display_name;
			} else {
				memberDataToSync.name = pkMemberResult.data.name;
			}
		}

		if (options.avatar) memberDataToSync.avatarUrl = pkMemberResult.data.avatar_url;
		if (options.pronouns) memberDataToSync.pronouns = pkMemberResult.data.pronouns;
		if (options.description) memberDataToSync.desc = pkMemberResult.data.description;
		if (options.color) memberDataToSync.color = pkMemberResult.data.color;

		const spMemberResult = await getCollection("members").findOne({ uid: userId, pkId: pkMemberId })

		if (spMemberResult) {
			await getCollection("members").updateOne({ uid: userId, pkId: pkMemberId }, { $set: memberDataToSync })
			return { success: true, msg: "Member updated on Plural Kit" }
		}
		else {

			await getCollection("members").insertOne({ uid: userId, pkId: pkMemberId }, memberDataToSync)
			return { success: true, msg: "Member added to Plural Kit" }
		}
	}
	else {
		return { success: false, msg: `${pkMemberResult.status.toString()} - ${pkMemberResult.statusText}` }
	}
}

export const syncAllSpMembersToPk = async (options: syncOptions, allSyncOptions: syncAllOptions, token: string, userId: string): Promise<{ success: boolean, msg: string }> => {
	const spMembersResult = await getCollection("members").find({ uid: userId }).toArray()
	for (let i = 0; i < spMembersResult.length; ++i) {
		const member = spMembersResult[i];
		if (member.pkId && allSyncOptions.overwrite) {
			await syncMemberToPk(options, member._id, token, userId);
		} else if (!member.pkId && allSyncOptions.add) {
			await syncMemberToPk(options, member._id, token, userId);
		}
	}

	return { success: true, msg: "" }
}

export const syncAllPkMembersToSp = async (options: syncOptions, allSyncOptions: syncAllOptions, token: string, userId: string): Promise<{ success: boolean, msg: string }> => {
	const pkMembersResult = await axios.get(`https://api.pluralkit.me/v2/systems/@me/members`, { headers: { authorization: token } })
	if (pkMembersResult.status === 200) {

		const foundMembers: any[] = pkMembersResult.data

		for (let i = 0; i < foundMembers.length; ++i) {
			const member = foundMembers[i];

			const spMemberResult = await getCollection("members").findOne({ uid: userId, pkId: parseId(member.id) })
			if (spMemberResult && allSyncOptions.overwrite) {
				await syncMemberFromPk(options, member.id, token, userId);
			}

			if (!spMemberResult && allSyncOptions.add) {
				await syncMemberFromPk(options, member.id, token, userId);
			}
		}

		return { success: true, msg: "" }
	}
	else {
		return { success: false, msg: `${pkMembersResult.status.toString()} - ${pkMembersResult.statusText}` }
	}
}