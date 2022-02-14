import { getCollection, parseId } from "../../mongo"
import { addPendingRequest, PkRequest, PkRequestType } from "./controller"

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
const spColorToPkColor = (color: string | undefined): string | undefined => {
	let pkColor = "";

	if (color) {
		if (color.length === 7) {
			pkColor = color.substring(0, 6);
		} else if (color.length === 9) {
			pkColor = color.substring(0, 6);
		} else if (color.length === 6) {
			pkColor = color;
		}

		if (RegExp(/^([a-fA-F0-9]{6})$/).test(pkColor)) {
			return pkColor;
		}
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

	if (spMemberResult) {
		if (spMemberResult.pkId) {
			const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${spMemberResult.pkId}`, token, response: null, data: undefined, type: PkRequestType.Get }
			const pkMemberResult = await addPendingRequest(getRequest)
			if (pkMemberResult) {
				if (pkMemberResult.status == 200) {

					const patchRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${spMemberResult.pkId}`, token, response: null, data: memberDataToSync, type: PkRequestType.Patch }
					const patchResult = await addPendingRequest(patchRequest)
					if (patchResult) {
						if (patchResult.status === 200) {
							return { success: true, msg: "Member updated on Plural Kit" }
						}
						else {
							return { success: false, msg: `${patchResult.status.toString()} - ${patchResult.statusText}` }
						}
					}
				}
				else if (pkMemberResult && pkMemberResult.status === 404) {

					const postRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members`, token, response: null, data: memberDataToSync, type: PkRequestType.Post }
					const postResult = await addPendingRequest(postRequest)
					if (postResult) {
						if (postResult.status === 200) {
							return { success: true, msg: "Member added to Plural Kit" }
						}
						else {
							return { success: false, msg: `${postResult.status.toString()} - ${postResult.statusText}` }
						}
					}
				}
				else {
					return { success: false, msg: `${pkMemberResult.status.toString()} - ${pkMemberResult.statusText}` }
				}
			}
		}
		else {
			if (!spMemberResult.pkId) {
				const postRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members`, token, response: null, data: memberDataToSync, type: PkRequestType.Post }
				const postResult = await addPendingRequest(postRequest)
				if (postResult) {
					if (postResult.status === 200) {
						return { success: true, msg: "Member added to Plural Kit" }
					}
					else {
						return { success: false, msg: `${postResult.status.toString()} - ${postResult.statusText}` }
					}
				}
			}
			else {
				return { success: false, msg: "Member does not exist in Simply Plural for this account." }
			}
		}
	}

	return { success: false, msg: "Member does not exist in Simply Plural for this account." }
}

export const syncMemberFromPk = async (options: syncOptions, pkMemberId: string, token: string, userId: string): Promise<{ success: boolean, msg: string }> => {
	const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${pkMemberId}`, token, response: null, data: undefined, type: PkRequestType.Get }
	const pkMemberResult = await addPendingRequest(getRequest)

	if (pkMemberResult) {
		if (pkMemberResult.status === 200) {

			const spMemberResult = await getCollection("members").findOne({ uid: userId, pkId: pkMemberId })
			const forceSyncProperties = spMemberResult == null;
			const memberDataToSync: any = {}
			if (options.name || forceSyncProperties) {
				if (options.useDisplayName) {
					memberDataToSync.name = pkMemberResult.data.display_name;
				} else {
					memberDataToSync.name = pkMemberResult.data.name;
				}
			}

			if (options.avatar || forceSyncProperties) memberDataToSync.avatarUrl = pkMemberResult.data.avatar_url;
			if (options.pronouns || forceSyncProperties) memberDataToSync.pronouns = pkMemberResult.data.pronouns;
			if (options.description || forceSyncProperties) memberDataToSync.desc = pkMemberResult.data.description;
			if (options.color || forceSyncProperties) memberDataToSync.color = pkMemberResult.data.color;

			if (spMemberResult) {
				await getCollection("members").updateOne({ uid: userId, pkId: pkMemberId }, { $set: memberDataToSync })
				return { success: true, msg: "Member updated on Simply Plural" }
			}
			else {
				memberDataToSync.uid = userId;
				memberDataToSync.pkId = pkMemberId;

				if (pkMemberResult.data.privacy?.visibility === "private") {
					memberDataToSync.private = true;
					memberDataToSync.preventTrusted = true;
				}
				else {
					memberDataToSync.private = false;
					memberDataToSync.preventTrusted = false;
				}

				await getCollection("members").insertOne(memberDataToSync)
				return { success: true, msg: "Member added to Simply Plural" }
			}
		}
		else {
			return { success: false, msg: `${pkMemberResult.status.toString()} - ${pkMemberResult.statusText}` }
		}
	}
	else {
		return { success: false, msg: `Internal error in plural kit controller` }
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
	const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/systems/@me/members`, token, response: null, data: undefined, type: PkRequestType.Get }
	const pkMembersResult = await addPendingRequest(getRequest)
	if (pkMembersResult) {
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
	else {
		return { success: false, msg: `Internal error in plural kit controller` }
	}
}