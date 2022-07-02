
import { getCollection, parseId } from "../../../../../modules/mongo"
import { SimplyPluralDb } from "../../../../../util/types";

export const update151 = async (uid: string) => {

	const members = await getCollection("members",SimplyPluralDb).find({ uid }).toArray();
	// Remove null info fields
	for (let i = 0; i < members.length; ++i) {
		const member = members[i]
		const memberInfo: { [key: string]: string } | undefined = member.info
		if (memberInfo) {

			const keys = Object.keys(memberInfo);
			const newFields: { [key: string]: string } = {}
			let changed = false;
			for (let x = 0; x < keys.length; ++x) {

				const key: string = keys[x];
				const value: string = memberInfo[key];

				if (value) {
					newFields[key] = value;
				}
				else {
					changed = true;
				}
			}

			if (changed === true) {
				await getCollection("members", SimplyPluralDb).updateOne({ _id: parseId(member._id), uid }, { $set: { info: newFields } });
			}
		}
	}
}