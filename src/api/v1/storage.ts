import { Request, Response } from "express"
import { logger, userLog } from "../../modules/logger"
import { ajv, validateSchema } from "../../util/validation"
import { isUserVerified } from "../../security"
import promclient from "prom-client"

import {fileTypeFromBuffer} from 'file-type';

import { storageController } from "../../modules/storage/storageController"
import { doesUserHaveVersion, ONE_TWELVE } from "../../util/version"
import { config } from "../../modules/config"

export const update_avatar_counter = new promclient.Counter({
	name: "apparyllis_api_avatar_upload",
	help: "Counter for avatar uploads",
})

export const validateAvatar = async (req: Request, res: Response): Promise<boolean> => {
	const buffer = Buffer.from(req.body["buffer"])
	const resolvedFileType = await fileTypeFromBuffer(buffer as Uint8Array)

	if (!resolvedFileType) {
		res.status(400).send("File type cannot be detected from the file, try using another picture.")
		return false
	}

	const mime = resolvedFileType.mime
	const validMime = mime === "image/png" || mime === "image/jpeg"
	if (!validMime) {
		res.status(400).send(`File type not valid. Only JPG and PNG are supported. Your file type is ${mime}`)
		return false
	}

	return true
}

export const Store = async (req: Request, res: Response) => {
	const result = await isUserVerified(res.locals.uid)
	if (result === false) {
		res.status(403).send("You need to verify your account to upload images")
		return false
	}

	const userHasTwelve = await doesUserHaveVersion(res.locals.uid, ONE_TWELVE)
	if (userHasTwelve) {
		res.status(400).send("Please update your app to the latest version to upload images, or use the web-app.")
		return false
	}

	const isValidAvatar = await validateAvatar(req, res)
	if (!isValidAvatar) {
		return false
	}

	const path = `avatars/${res.locals.uid}/${req.params.dashedid}`

	const buffer = Buffer.from(req.body["buffer"])

	update_avatar_counter.inc()

	const putResult = await storageController?.put(path, buffer)

	if (putResult) {
		res.status(200).send({ success: true, msg: { url: `${config().storage?.baseUrl ?? ""}/${path}` } })
		userLog(res.locals.uid, `Stored avatar with size: ${buffer.length}`)
	} else {
		res.status(500).send("Error uploading avatar")
	}
}

const s_validateStoreAvatarSchema = {
	type: "object",
	properties: {
		buffer: { type: "array", items: { type: "number", minimum: 0, maximum: 255 } },
	},
	nullable: false,
	required: ["buffer"],
	additionalProperties: false,
}
const v_validateStoreAvatarSchema = ajv.compile(s_validateStoreAvatarSchema)

export const validateStoreAvatarSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateStoreAvatarSchema, body)
}

export const Delete = async (req: Request, res: Response) => {
	const result = await isUserVerified(res.locals.uid)
	if (result === false) {
		res.status(403).send("You need to verify your account to delete images")
		return false
	}

	const userHasTwelve = await doesUserHaveVersion(res.locals.uid, ONE_TWELVE)
	if (userHasTwelve) {
		res.status(400).send("Please update your app to the latest version to delete images, or use the web-app.")
		return false
	}

	const path = `avatars/${res.locals.uid}/${req.params.dashedid}`

	const deleteResult = await storageController?.delete(path)

	if (deleteResult) {
		res.status(200).send("Deleted avatar")
		userLog(res.locals.uid, "Deleted avatar")
	} else {
		res.status(400).send("Avatar not deleted, either it did not exist or something went wrong")
	}
}
