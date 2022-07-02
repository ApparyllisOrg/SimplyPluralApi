import { Request, Response } from "express";
import { userLog } from "../../modules/logger";
import { getCollection } from "../../modules/mongo";

export const performUsernameUpdate = async (req: Request, res: Response, db: string) =>
{
	const newUsername: string = req.body["username"].trim();

	if (newUsername.length < 3) {
		res.status(200).send({ success: false, msg: "Username must be at least 3 characters" });
		return;
	}

	const potentiallyAlreadyTakenUserDoc = await getCollection("users", db).findOne({ username: { $regex: "^" + newUsername + "$", $options: "i" }, uid: { $ne: res.locals.uid } });

	if (potentiallyAlreadyTakenUserDoc === null) {
		getCollection("users", db).updateOne({ uid: res.locals.uid }, { $set: { username: newUsername } });
		res.status(200).send({ success: true });
		userLog(res.locals.uid, "Updated username to: " + newUsername);
		return;
	} else {
		res.status(200).send({ success: false, msg: "This username is already taken" });
		return;
	}
}