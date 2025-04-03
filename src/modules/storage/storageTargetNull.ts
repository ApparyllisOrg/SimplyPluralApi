import { StoragePutOptions, StorageTarget } from "./storageTarget"

// Null target for unit tests, simply returns without doing operations.
export class StorageTargetNull implements StorageTarget {
	init() {}

	async get(path: string): Promise<Buffer | undefined> {
		return undefined
	}

	async put(path: string, buffer: Buffer, options: StoragePutOptions | undefined): Promise<boolean> {
		return true
	}

	async delete(path: string): Promise<boolean> {
		return true
	}

	async deleteFolder(path: string): Promise<boolean> {
		return true
	}
}
