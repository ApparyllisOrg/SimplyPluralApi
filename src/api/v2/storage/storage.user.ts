import { Request, Response } from "express"
import { DeleteAvatarForObject, StoreAvatarForObject } from "./storage.utils"
import { getCollection } from "../../../modules/mongo"

export const StoreUserAvatar = async (req: Request, res: Response) => {
	const content = await getCollection("users").findOne({ uid: res.locals.uid, _id: res.locals.uid })

	if (!content) {
		res.status(400).send("Something went wrong, cannot find users to update.")
		return
	}

	StoreAvatarForObject(req, res, "users", res.locals.uid, content.avatarUuid)
}

export const DeleteUserAvatar = async (req: Request, res: Response) => {
	const content = await getCollection("users").findOne({ uid: res.locals.uid, _id: res.locals.uid })

	if (!content) {
		res.status(400).send("Something went wrong, cannot find users to update.")
		return
	}

	DeleteAvatarForObject(req, res, "users", res.locals.uid, content.avatarUuid)
}
