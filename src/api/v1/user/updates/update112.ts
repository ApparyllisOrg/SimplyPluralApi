
import { Request, Response } from "express";
import shortUUID from "short-uuid";
import { userLog } from "../../../../modules/logger";
import { getCollection } from "../../../../modules/mongo";


export const update122 = async (_req: Request, res: Response) => {
	const membersCollection = getCollection("members");
	const users = getCollection("users");
	const members = membersCollection.find({ uid: res.locals.uid });
	const user = await users.findOne({ uid: res.locals.uid });

	if (user.fields) {
		res.status(200).send();
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

	userLog(res.locals.uid, "Updated to 122");
	await users.updateOne({ uid: res.locals.uid }, { $set: { fields: infoFields } });
	res.status(200).send();
};