export interface StoragePutOptions {
	s3?: {
		acl?: string | undefined
	}
}

export interface StorageTarget {
	get(path: string): Promise<Buffer | undefined>
	put(path: string, buffer: Buffer, options?: StoragePutOptions | undefined): Promise<boolean>
	delete(path: string): Promise<boolean>
	deleteFolder(path: string): Promise<boolean>
}
