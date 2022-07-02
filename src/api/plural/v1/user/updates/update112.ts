import shortUUID from "short-uuid";
import { userLog } from "../../../../../modules/logger";
import { getCollection } from "../../../../../modules/mongo";
import { SimplyPluralDb } from "../../../../../util/types";


export const update122 = async (uid: string) => {
	const membersCollection = getCollection("members", SimplyPluralDb);
	const users = getCollection("users", SimplyPluralDb);
	const members = membersCollection.find({ uid: uid });

	const user = await users.findOne({ uid })

	// Don't run update if we already have fields...
	if (user.fields) {
		return;
	}

	const infoFields: Map<string, any> = new Map<string, any>();
	const infoFieldConversions: Map<string, any> = new Map<string, any>();
	await members.forEach((member: any) => {
		const newInfo: Map<string, any> = new Map<string, any>();

		let id = 0;

		if (member.info) {
			for (const key of Object.keys(member.info)) {
				// Don't check for collisions for this, just append a unique id behind it so we can ensure collision-free update
				const uniqueId: string = shortUUID.generate() + id.toString();
				const name: string = key;

				if (!infoFieldConversions.has(name)) {
					infoFieldConversions.set(name, uniqueId);

					const newField: any = {};
					newField.name = name;
					newField.order = id;
					newField.private = false;
					newField.type = 0;
					newField.preventTrusted = false;

					infoFields.set(uniqueId, newField);
				}

				id++;
			}

			// Convert the-already existing fields.
			for (const key of Object.keys(member.info)) {
				newInfo.set(infoFieldConversions.get(key), member.info[key]);
			}

			membersCollection.updateOne({ _id: member._id }, { $set: { info: newInfo } });
		}
	});

	userLog(uid, "Updated to 122");
	await users.updateOne({ uid: uid }, { $set: { fields: infoFields } });
};