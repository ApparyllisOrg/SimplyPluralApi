import { Request, Response } from "express"
import { isUserVerified } from "../../../security"
import { update_avatar_counter, validateAvatar } from "../../v1/storage"
import { getCollection, parseId } from "../../../modules/mongo"
import { uuid } from "short-uuid"
import { storageController } from "../../../modules/storage/storageController"
import { userLog } from "../../../modules/logger"
import { ajv, validateSchema } from "../../../util/validation"

const validateAvatarUuid = (avatarUuid: string) => {
	// Ensure regexp matches the correct uid format
	// Invalid regexp could lead to unintentional deletion
	return RegExp("^([a-zA-Z0-9-]{1,128})$").test(avatarUuid)
}

export const StoreAvatarForObject = async (req: Request, res: Response, collection: string, id: string, previousAvatarUuid: string) => {
	const result = await isUserVerified(res.locals.uid)
	if (result === false) {
		res.status(403).send("You need to verify your account to upload images")
		return
	}

	const isValidAvatar = await validateAvatar(req, res)
	if (!isValidAvatar) {
		return
	}

	const avatarUuid = uuid().toString()
	const path = `avatars/${res.locals.uid}/${avatarUuid}`
	const buffer = Buffer.from(req.body["buffer"])

	update_avatar_counter.inc()

	const putResult = await storageController?.put(path, buffer)

	if (putResult) {
		await getCollection(collection).updateOne({ uid: res.locals.uid, _id: parseId(id) }, { $set: { avatarUuid } })

		if (previousAvatarUuid && previousAvatarUuid.length > 0) {
			if (validateAvatarUuid(previousAvatarUuid)) {
				const path = `avatars/${res.locals.uid}/${previousAvatarUuid}`
				await storageController?.delete(path)
			}
		}

		res.status(200).send({ url: `https://serve.apparyllis.com/avatars/${path}`, avatarUuid: avatarUuid })
		userLog(res.locals.uid, `Stored avatar with size: ${buffer.length}`)
	} else {
		res.status(500).send("Error uploading avatar")
	}
}

export const DeleteAvatarForObject = async (req: Request, res: Response, collection: string, id: string, previousAvatarUuid: string) => {
	const result = await isUserVerified(res.locals.uid)
	if (result === false) {
		res.status(403).send("You need to verify your account to delete images")
		return
	}

	if (previousAvatarUuid && previousAvatarUuid.length > 0) {
		// If avatarUuid is not a valid regex, simply unset the avatar field as no avatar could belong to it
		if (!validateAvatarUuid(previousAvatarUuid)) {
			await getCollection(collection).updateOne({ uid: res.locals.uid, _id: parseId(id) }, { $unset: { avatarUuid: "" } })
			res.status(200).send("Avatar field was unset, previous avatar could not be found")
			return
		}

		const path = `avatars/${res.locals.uid}/${previousAvatarUuid}`

		const deleteResult = await storageController?.delete(path)

		if (deleteResult) {
			await getCollection(collection).updateOne({ uid: res.locals.uid, _id: parseId(id) }, { $unset: { avatarUuid: "" } })

			res.status(200).send("Deleted avatar")
			userLog(res.locals.uid, "Deleted avatar")
		} else {
			res.status(400).send("Avatar not deleted, either it did not exist or something went wrong")
		}
	} else {
		res.status(404).send("Target does not have an avatar stored, cannot delete.")
	}
}

const s_validatAvatarParamsSchema = {
	type: "object",
	properties: {
		type: { type: "string", pattern: "^(member)|(customFront)$" },
		id: { type: "string", pattern: "^[A-Za-z0-9]{5,50}$" },
	},
	nullable: false,
	required: ["type", "id"],
	additionalProperties: false,
}
const v_validateStoreAvatarParamsSchema = ajv.compile(s_validatAvatarParamsSchema)

export const validateStoreAvatarParamsSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateStoreAvatarParamsSchema, body)
}
