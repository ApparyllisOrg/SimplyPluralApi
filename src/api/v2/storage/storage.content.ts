import { Request, Response } from "express"
import { getCollection, parseId } from "../../../modules/mongo"
import { DeleteAvatarForObject, StoreAvatarForObject } from "./storage.utils"

const typeToCollection = (type: string) => {
	if (type === "member") {
		return "members"
	} else if (type === "customFront") {
		return "frontStatuses"
	} else {
		return undefined
	}
}

export const StoreContentAvatar = async (req: Request, res: Response) => {
	const type: string = req.params.type

	const collectionName = typeToCollection(type)
	if (!collectionName) {
		res.status(500).send("Unable to deduce avatar type, something went wrong.")
		return
	}

	const id: string = req.params.id

	const content = await getCollection(collectionName).findOne({ uid: res.locals.uid, _id: parseId(id) })

	if (!content) {
		res.status(404).send("Cannot find target to set avatar of. Are you sure this content (member, customfront) exists?")
		return
	}

	StoreAvatarForObject(req, res, collectionName, id, content.avatarUuid)
}

export const DeleteContentAvatar = async (req: Request, res: Response) => {
	const type: string = req.params.type

	const collectionName = typeToCollection(type)
	if (!collectionName) {
		res.status(500).send("Unable to deduce avatar type, something went wrong.")
		return
	}

	const id: string = req.params.id

	const content = await getCollection(collectionName).findOne({ uid: res.locals.uid, _id: parseId(id) })

	if (!content) {
		res.status(404).send("Cannot find target to delete avatar of. Are you sure this content (member, customfront) exists?")
		return
	}

	DeleteAvatarForObject(req, res, collectionName, id, content.avatarUuid)
}
