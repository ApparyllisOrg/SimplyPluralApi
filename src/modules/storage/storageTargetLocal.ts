/* eslint-disable security/detect-non-literal-fs-filename */

import { writeFile, readFile, mkdir, unlink, rm, realpath, lstat } from "fs/promises"
import * as path from "path"
import { StorageTarget } from "./storageTarget"
import { mkdirSync, realpathSync } from "fs"
import { fileTypeFromBuffer, FileTypeResult } from "file-type"

// We use `file-type` to detect file types based on magic bytes, but it can't detect text files (html), 
// so this map contains allowed text types that we use in the app and determine them based on extension as a fallback.
// This slightly leaks into implementation details, but it's the best option without major refactoring.
const ALLOWED_TEXT_TYPES = new Map<string, string>([
	["html", "text/html"],
])

export class StorageTargetLocal implements StorageTarget {
	private readonly baseDir: string;

	private readonly realBaseDir: string;

	constructor(baseDir: string) {
		this.baseDir = path.resolve(baseDir)

		// Ensure that the base directory exists, this action is idempotent.
		// (unless the path exists as a file, in that case it throws, which is expected)
		mkdirSync(this.baseDir, { recursive: true })

		this.realBaseDir = realpathSync(this.baseDir)
	}

	async get(filePath: string): Promise<Buffer | undefined> {
		try {
			const resolved = await this.resolveSafeReadPath(filePath)
			return await readFile(resolved)
		} catch (error) {
			if (isFileNotFound(error)) {
				return undefined
			}

			// Unexpected error, rethrow, could be a bug or a potential attack
			throw error
		}
	}

	async put(filePath: string, buffer: Buffer): Promise<boolean> {
		try {
			const meta = await this.getBufferTypeMeta(buffer, filePath)

			if (!meta) {
				// Let's be offensive here, files should be in standard structure, if they're malformed or missing, 
				// it's safer to reject them than to risk storing something potentially harmful.
				throw new Error("Unable to determine file type, refusing to store file")
			}

			const resolvedPath = await this.resolveSafeWritePath(filePath)

			await writeFile(
				resolvedPath,
				new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
			)

			// When serving files later, we can use this to correctly set content headers. 
			// This may not be ideal, but it's better than determining it on the fly.
			const metaPath = resolvedPath + ".meta.json"
			await writeFile(
				metaPath,
				JSON.stringify(meta),
			)

			return true
		} catch (error) {
			console.error(`Error writing file "${filePath}":`, error)
			return false
		}
	}

	async delete(filePath: string): Promise<boolean> {
		try {
			const resolved = await this.resolveSafeReadPath(filePath)
			
			await unlink(resolved)
			await unlink(resolved + ".meta.json").catch(() => {
				// no-op, ignore if meta file doesn't exist
			})

			return true
		} catch (error) {
			if (!isFileNotFound(error)) {
				// Unexpected error, rethrow, could be a bug or a potential attack
				throw error
			}

			return false
		}
	}

	async deleteFolder(folderPath: string): Promise<boolean> {
		try {
			const resolved = await this.resolveSafeReadPath(folderPath)
			await rm(resolved, { recursive: true, force: true })
			return true
		} catch (error) {
			if (!isFileNotFound(error)) {
				throw error
			}

			return false
		}
	}

	/**
	 * Resolve an existing filesystem path and ensure its real target stays inside baseDir.
	 */
	private async resolveSafeReadPath(targetPath: string): Promise<string> {
		const resolvedPath = path.resolve(this.baseDir, targetPath)
		const realTargetPath = await realpath(resolvedPath)

		if (!isInsideDir(realTargetPath, this.realBaseDir)) {
			throw new Error("Possible path traversal attack detected")
		}

		return realTargetPath
	}

	/**
	 * Resolve a filesystem path for writing, ensuring that the final target path stays inside baseDir 
	 * and that no symlinks are used to escape it.
	 */
	private async resolveSafeWritePath(targetPath: string): Promise<string> {
		const resolvedPath = path.resolve(this.baseDir, targetPath)
		const resolvedParent = path.dirname(resolvedPath)

		// Create parent dirs before resolving realpath, otherwise realpath fails on non-existent paths
		await mkdir(resolvedParent, { recursive: true })

		const realParent = await realpath(resolvedParent)

		// Since the file may not exist, we check the parent directory's real path to prevenrett path traversal.
		if (!isInsideDir(realParent, this.realBaseDir)) {
			throw new Error("Possible path traversal attack detected")
		}

		const finalPath = path.join(realParent, path.basename(resolvedPath))

		try {
			const stat = await lstat(finalPath)

			// If the file already exists, ensure it's not a symlink to prevent writing outside of baseDir
			if (stat.isSymbolicLink()) {
				throw new Error("Refusing to write through symlink")
			}
		} catch (error) {
			if (!isFileNotFound(error)) {
				throw error
			}

			// If the file doesn't exist, we can proceed to write
		}

		return finalPath
	}

	private async getBufferTypeMeta(buffer: Buffer, filePath: string): Promise<FileTypeResult | null> {
		const detected = await fileTypeFromBuffer(buffer as Uint8Array)

		if (detected) {
			return detected
		}

		// file-type uses magic bytes and can't detect text formats, fall back to extension
		const ext = path.extname(filePath).toLowerCase().slice(1)
		const mime = ALLOWED_TEXT_TYPES.get(ext)

		if (mime) {
			return { ext, mime }
		}

		return null
	}
}

/**
 * Checks if the candidate path is inside the base directory.
 * 
 * @param {string} candidate Candidate absolute path 
 * @param {string} rootDir Absolute path to the root directory
 */
function isInsideDir(candidate: string, rootDir: string): boolean {
	const relative = path.relative(rootDir, candidate)
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isFileNotFound(error: unknown): boolean {
	return isFileError(error) && error.code === "ENOENT"
}

function isFileError(error: unknown): error is { code: string } {
	return error !== null && typeof error === "object" && "code" in error
}