import { AxiosResponse } from "axios";
import { AnyBulkWriteOperation } from "mongodb";
import { ERR_FUNCTIONALITY_EXPECTED_ARRAY } from "../../errors";
import { getCollection, parseId } from "../../mongo";
import { dispatchCustomEvent } from "../../socket";
import { addPendingRequest, PkRequest, PkRequestType } from "./controller";
import * as Sentry from "@sentry/node";
import moment from "moment";
import validUrl from "valid-url";
export interface syncOptions {
	name: boolean;
	avatar: boolean;
	pronouns: boolean;
	description: boolean;
	useDisplayName: boolean;
	color: boolean;
}

export interface syncAllOptions {
	overwrite: boolean;
	add: boolean;
	privateByDefault: boolean;
}

// Simply Plural colors are supported in a wide variety.
// We officially support: #ffffff, ffffff, #ffffffff
const spColorToPkColor = (color: string | undefined): string | undefined => {
	let pkColor = "";

	if (color) {
		if (color.length === 7) {
			pkColor = color.substring(1, 7);
		} else if (color.length === 9) {
			pkColor = color.substring(1, 7);
		} else if (color.length === 6) {
			pkColor = color;
		}

		if (RegExp(/^([a-fA-F0-9]{6})$/).test(pkColor)) {
			return pkColor;
		}

		return pkColor;
	}

	return undefined;
};

const limitStringLength = (value: string | undefined, length: number) => {
	let newValue = null;
	if (value != null && value != undefined) {
		if (value.length > length) {
			newValue = value.substring(0, length);
		} else {
			newValue = value;
		}
	}
	return newValue;
};

const handlePkResponse = (requestResponse: AxiosResponse<any, any> | { status: number }) => {
	if (requestResponse.status === 401) {
		return { success: false, msg: `Failed to sync. PluralKit token is invalid.` };
	} else if (requestResponse.status === 403) {
		return { success: false, msg: `Failed to sync. You do not have access to this member.` };
	} else if (requestResponse.status === 502 || requestResponse.status === 503 || requestResponse.status === 504) {
		return { success: false, msg: `Failed to sync. We're unable to reach PluralKit.` };
	} else {
		return { success: false, msg: `${requestResponse.status?.toString() ?? ""}` };
	}
};

export const syncMemberToPk = async (options: syncOptions, spMemberId: string, token: string, userId: string, memberData: any | undefined, knownSystemId: string | undefined): Promise<{ success: boolean; msg: string }> => {
	const spMemberResult = await getCollection("members").findOne({ uid: userId, _id: parseId(spMemberId) });

	if (spMemberResult) {
		let { name = "", avatarUrl = "", pronouns = "", desc = "" } = spMemberResult;
		const { color } = spMemberResult;

		name = limitStringLength(name, 100);
		avatarUrl = limitStringLength(avatarUrl, 256);
		pronouns = limitStringLength(pronouns, 100);
		desc = limitStringLength(desc, 1000);

		const memberDataToSync: any = {};
		if (options.name) {
			if (options.useDisplayName) {
				memberDataToSync.display_name = name;
			} else {
				memberDataToSync.name = name;
			}
		}

		if (options.avatar && avatarUrl) memberDataToSync.avatar_url = avatarUrl;
		if (options.pronouns && pronouns) memberDataToSync.pronouns = pronouns;
		if (options.description && desc != null) memberDataToSync.description = desc;
		if (options.color && color) {
			const updateColor = spColorToPkColor(color);
			if (updateColor) {
				memberDataToSync.color = updateColor;
			}
		}

		if (memberDataToSync.avatar_url && !validUrl.isUri(memberDataToSync.avatar_url)) {
			delete memberDataToSync["avatar_url"];
		}

		const pkId: string | undefined | null = spMemberResult.pkId;
		if (pkId && pkId.length === 5) {
			const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${spMemberResult.pkId}`, token, response: null, data: undefined, type: PkRequestType.Get, id: "" };
			const pkMemberResult = memberData ?? (await addPendingRequest(getRequest));

			let status = memberData ? 200 : pkMemberResult?.status;
			if (pkMemberResult) {
				const getResultSystemId = pkMemberResult.data?.system ?? undefined;
				const memberSystemId = memberData ? knownSystemId : getResultSystemId;
				if (status == 200 && knownSystemId && memberSystemId != knownSystemId) {
					status = 404;
				}

				if (status == 200) {
					if (Object.keys(memberDataToSync).length > 0) {
						const patchRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${spMemberResult.pkId}`, token, response: null, data: memberDataToSync, type: PkRequestType.Patch, id: "" };
						const patchResult = await addPendingRequest(patchRequest);
						if (patchResult) {
							if (patchResult.status === 200) {
								return { success: true, msg: `${name} updated on PluralKit` };
							} else {
								return handlePkResponse(patchResult);
							}
						}
					} else {
						return { success: true, msg: `${name} not updated. No data to sync was selected` };
					}
				} else if (status === 404 || status === 403) {
					memberDataToSync.name = name;
					const postRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members`, token, response: null, data: memberDataToSync, type: PkRequestType.Post, id: "" };
					const postResult = await addPendingRequest(postRequest);
					if (postResult) {
						if (postResult.status === 200) {
							await getCollection("members").updateOne({ uid: userId, _id: parseId(spMemberId) }, { $set: { pkId: postResult.data.id } });
							return { success: true, msg: `${name} added to PluralKit` };
						} else {
							return handlePkResponse(postResult);
						}
					}
				} else {
					return handlePkResponse(pkMemberResult);
				}
			}

			return { success: false, msg: `Unable to reach PluralKit's servers` };
		} else {
			memberDataToSync.name = name;
			const postRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members`, token, response: null, data: memberDataToSync, type: PkRequestType.Post, id: "" };
			const postResult = await addPendingRequest(postRequest);

			if (postResult) {
				if (postResult.status === 200) {
					await getCollection("members").updateOne({ uid: userId, _id: parseId(spMemberId) }, { $set: { pkId: postResult.data.id } });
					return { success: true, msg: `${name} added to PluralKit` };
				}
				return handlePkResponse(postResult);
			}

			return { success: false, msg: `Unable to reach PluralKit's servers` };
		}
	}

	return { success: false, msg: "Member does not exist in Simply Plural for this account." };
};

export const syncMemberFromPk = async (options: syncOptions, pkMemberId: string, token: string, userId: string, memberData: any | undefined, batch: AnyBulkWriteOperation<any>[] | undefined, privateByDefault: boolean): Promise<{ success: boolean; msg: string }> => {
	let data: any | undefined = memberData;

	if (!memberData) {
		const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/members/${pkMemberId}`, token, response: null, data: undefined, type: PkRequestType.Get, id: "" };
		const pkMemberResult = await addPendingRequest(getRequest);
		if (pkMemberResult) {
			if (pkMemberResult.status === 200) {
				data = pkMemberResult.data;
			} else {
				return handlePkResponse(pkMemberResult);
			}
		} else {
			return { success: false, msg: `Unable to reach PluralKit's servers` };
		}
	}

	const spMemberResult = await getCollection("members").findOne({ uid: userId, pkId: pkMemberId });
	const forceSyncProperties = spMemberResult == null;
	const memberDataToSync: any = {};
	if (options.name || forceSyncProperties) {
		if (options.useDisplayName && data.display_name) {
			memberDataToSync.name = data.display_name;
		} else {
			memberDataToSync.name = data.name;
		}
	}

	if ((options.avatar || forceSyncProperties) && data.avatar_url) memberDataToSync.avatarUrl = data.avatar_url;
	if ((options.pronouns || forceSyncProperties) && data.pronouns) memberDataToSync.pronouns = data.pronouns;
	if ((options.description || forceSyncProperties) && data.description) memberDataToSync.desc = data.description;
	if ((options.color || forceSyncProperties) && data.color) memberDataToSync.color = data.color;

	if (spMemberResult) {
		if (memberDataToSync && Object.keys(memberDataToSync).length > 0) {
			{
				if (batch) {
					batch.push({ updateOne: { update: { $set: memberDataToSync }, filter: { uid: userId, pkId: pkMemberId } } });
				} else {
					await getCollection("members").updateOne({ uid: userId, pkId: pkMemberId }, { $set: memberDataToSync }, {});
				}
			}
		}
		return { success: true, msg: `${spMemberResult.name ?? ""} updated on Simply Plural` };
	} else {
		memberDataToSync.uid = userId;
		memberDataToSync.pkId = pkMemberId;

		if (memberData.privacy?.visibility === "private" || privateByDefault) {
			memberDataToSync.private = true;
			memberDataToSync.preventTrusted = true;
		} else {
			memberDataToSync.private = false;
			memberDataToSync.preventTrusted = false;
		}

		memberDataToSync.preventsFrontNotifs = false;

		if (batch) {
			batch.push({ insertOne: { document: memberDataToSync } });
		} else {
			await getCollection("members").insertOne(memberDataToSync);
		}

		return { success: true, msg: `${memberData.name} added to Simply Plural` };
	}
};

export const syncAllSpMembersToPk = async (options: syncOptions, _allSyncOptions: syncAllOptions, token: string, userId: string): Promise<{ success: boolean; msg: string }> => {
	const spMembersResult = await getCollection("members").find({ uid: userId }).toArray();

	dispatchCustomEvent({ uid: userId, type: "syncToUpdate", data: "Starting Sync" });

	const getSystemRequest: PkRequest = { path: `https://api.pluralkit.me/v2/systems/@me`, token, response: null, data: undefined, type: PkRequestType.Get, id: "" };
	const systemResult = await addPendingRequest(getSystemRequest);

	if (systemResult?.status !== 200) {
		return handlePkResponse(systemResult!);
	}

	const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/systems/@me/members`, token, response: null, data: undefined, type: PkRequestType.Get, id: "" };
	const pkMembersResult = await addPendingRequest(getRequest);

	const foundMembers: any[] = pkMembersResult?.data ?? [];
	if (!Array.isArray(foundMembers)) {
		Sentry.captureMessage(`ErrorCode(${ERR_FUNCTIONALITY_EXPECTED_ARRAY})`, (scope) => {
			scope.setExtra("payload", pkMembersResult?.data);
			return scope;
		});
		return { success: true, msg: `Something went wrong, please try again later. ErrorCode(${ERR_FUNCTIONALITY_EXPECTED_ARRAY})` };
	}

	let lastUpdate = 0;

	for (let i = 0; i < spMembersResult.length; ++i) {
		const member = spMembersResult[i];

		const currentCount = i + 1;

		if (moment.now() > lastUpdate + 1000) {
			dispatchCustomEvent({ uid: userId, type: "syncToUpdate", data: `Syncing ${member.name}, ${currentCount.toString()} out of ${spMembersResult.length.toString()}` });
			lastUpdate = moment.now();
		}

		const foundMember: any | undefined = foundMembers.find((value) => value.id === member.pkId);

		const result = await syncMemberToPk(options, member._id, token, userId, foundMember, systemResult?.data.id);
		console.log(result);
	}
	return { success: true, msg: "Sync completed" };
};

export const syncAllPkMembersToSp = async (options: syncOptions, allSyncOptions: syncAllOptions, token: string, userId: string): Promise<{ success: boolean; msg: string }> => {
	dispatchCustomEvent({ uid: userId, type: "syncFromUpdate", data: "Starting Sync" });

	const getRequest: PkRequest = { path: `https://api.pluralkit.me/v2/systems/@me/members`, token, response: null, data: undefined, type: PkRequestType.Get, id: "" };
	const pkMembersResult = await addPendingRequest(getRequest);

	let lastUpdate = 0;

	if (pkMembersResult) {
		if (pkMembersResult.status === 200) {
			const foundMembers: any[] = pkMembersResult.data;
			const promises: Promise<{ success: boolean; msg: string }>[] = [];

			const bulkWrites: AnyBulkWriteOperation<any>[] = [];

			for (let i = 0; i < foundMembers.length; ++i) {
				const member = foundMembers[i];
				const currentCount = i + 1;

				if (moment.now() > lastUpdate + 1000) {
					dispatchCustomEvent({ uid: userId, type: "syncFromUpdate", data: `Syncing ${member.name}, ${currentCount.toString()} out of ${foundMembers.length.toString()}` });
					lastUpdate = moment.now();
				}

				const spMemberResult = await getCollection("members").findOne({ uid: userId, pkId: parseId(member.id) });
				if (spMemberResult && allSyncOptions.overwrite) {
					promises.push(syncMemberFromPk(options, member.id, token, userId, foundMembers[i], bulkWrites, allSyncOptions.privateByDefault));
				}

				if (!spMemberResult && allSyncOptions.add) {
					promises.push(syncMemberFromPk(options, member.id, token, userId, foundMembers[i], bulkWrites, allSyncOptions.privateByDefault));
				}
			}

			await Promise.all(promises);

			if (bulkWrites && bulkWrites.length > 0) {
				getCollection("members").bulkWrite(bulkWrites);
			}

			return { success: true, msg: "" };
		} else {
			return handlePkResponse(pkMembersResult);
		}
	} else {
		return { success: false, msg: `Unable to reach PluralKit's servers` };
	}
};
