import { Request, Response } from "express"
import { storageController } from "../../modules/storage/storageController"
import { FileTypeResult } from "file-type"

export async function serveStorageFile(req: Request, res: Response) {
	const filePath = req.params[0]

	if (!filePath || filePath.includes("..")) {
		res.status(400).send("Invalid path")
		return
	}

	// Currently, this endpoint is scoped to only serve files from local storage target, but in the future 
	// it should be extended to allow serving from any storage target, for self-hosting purposes.
	const file = await getFileWithMetadata(filePath)

	if (!file) {
		res.status(404).send("Not found")
		return
	}

	res.header("Content-Type", file.meta.mime)
	res.send(file.buffer)
}

async function getFileWithMetadata(filePath: string): Promise<{ buffer: Buffer; meta: FileTypeResult } | null> {
	const buffer = await storageController?.get(filePath)

	if (!buffer) {
		return null
	}

	const metaBuffer = await storageController?.get(filePath + ".meta.json")

	if (!metaBuffer) {
		return null
	}
	
	const meta: FileTypeResult = JSON.parse(metaBuffer.toString())

	return { buffer, meta }
}
