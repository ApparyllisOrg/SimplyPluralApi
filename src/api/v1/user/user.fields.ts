import { getCollection } from "../../../modules/mongo"
import { canSeeMembers, getFriendLevel, isTrustedFriend } from "../../../security"
import { fetchBucketsForFriend } from "../../../util"
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "./updates/updateUser"

export const filterFields = async (friend: string, owner: string, inFields: any) => {
	const newFields: any = {}

	const canSee = await canSeeMembers(owner, friend)
	if (canSee) {
		const hasMigrated = await doesUserHaveVersion(owner, FIELD_MIGRATION_VERSION)
		if (hasMigrated) {
			const friendBuckets = await fetchBucketsForFriend(friend, owner)

			const userFields = await getCollection("customFields")
				.find({ uid: owner, buckets: { $in: friendBuckets } })
				.sort({ order: 1 })
				.toArray()

			const friendMigrated = await doesUserHaveVersion(friend, FIELD_MIGRATION_VERSION)
			if (friendMigrated === true) {
				for (let i = 0; i < userFields.length; ++i) {
					const field = userFields[i]
					newFields[field._id.toString()] = { name: field.name, order: field.order, type: field.type }
				}
			} else {
				for (let i = 0; i < userFields.length; ++i) {
					const field = userFields[i]
					newFields[field._id.toString()] = { name: field.name, order: i, type: field.type }
				}
			}
		} // Legacy custom fields
		else {
			const friendLevel = await getFriendLevel(owner, friend)
			const isATrustedFriends = isTrustedFriend(friendLevel)

			const friendMigrated = await doesUserHaveVersion(friend, FIELD_MIGRATION_VERSION)

			if (inFields) {
				Object.keys(inFields).forEach((key: string) => {
					const field = inFields[key]
					if (field.private === true && field.preventTrusted === false && isATrustedFriends) {
						newFields[key] = field

						if (friendMigrated === true) {
							newFields[key].order = newFields[key].order.toString()
						}
					}
					if (field.private === false && field.preventTrusted === false) {
						newFields[key] = field
						if (friendMigrated === true) {
							newFields[key].order = newFields[key].order.toString()
						}
					}
				})
			}
		}
	}

	return newFields
}
