import { DeleteObjectCommand, DeleteObjectCommandInput, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3"
import { StoragePutOptions, StorageTarget } from "./storageTarget"
import { logger } from "../logger"
import { devLog } from "../development"

export class StorageTargetS3 implements StorageTarget {
	private s3: S3Client | undefined
	private bucketId: string

	constructor(bucketId: string) {
		this.bucketId = bucketId
	}

	init(endpoint: string, region: string, accessKey: string, secret: string) {
		this.s3 = new S3Client({
			endpoint: endpoint,
			region: region,
			credentials: { accessKeyId: accessKey, secretAccessKey: secret },
		})
	}

	async get(path: string): Promise<Buffer | undefined> {
		if (!this.s3) {
			return undefined
		}

		const params = {
			Bucket: this.bucketId,
			Key: path,
		}
		try {
			const command = new GetObjectCommand(params)

			const file = await this.s3.send(command)
			if (file && file.Body) {
				const buffer = await file.Body.transformToByteArray()
				return Buffer.from(buffer)
			}
		} catch (e) {
			if (e instanceof S3ServiceException) {
				devLog(e.message)
			}
			return undefined
		}

		return undefined
	}

	async put(path: string, buffer: Buffer, options: StoragePutOptions | undefined): Promise<boolean> {
		if (!this.s3) {
			return false
		}

		const params = {
			Bucket: this.bucketId,
			Key: path,
			Body: buffer,
			ACL: options?.s3.ACL,
		}

		try {
			const command = new PutObjectCommand(params)

			const result = await this.s3.send(command)

			if (result) {
				return true
			}
		} catch (e) {
			if (e instanceof S3ServiceException) {
				devLog(e.message)
			}
			return false
		}

		return true
	}

	async delete(path: string): Promise<boolean> {
		if (!this.s3) {
			return false
		}

		const params: DeleteObjectCommandInput = {
			Bucket: this.bucketId,
			Key: path,
		}

		try {
			const headCommand = new HeadObjectCommand(params)
			await this.s3.send(headCommand)
		} catch (e) {
			if (e instanceof S3ServiceException) {
				if (e.$metadata.httpStatusCode == 404) {
					return false
				}
				devLog(e.message)
			}
		}

		try {
			const deleteCommand = new DeleteObjectCommand(params)
			const result = await this.s3.send(deleteCommand)
			return !!result
		} catch (e) {
			if (e instanceof S3ServiceException) {
				devLog(e.message)
			}
		}

		return false
	}

	async deleteFolder(path: string): Promise<boolean> {
		const recursiveDelete = async (path: string, token: string | undefined): Promise<boolean> => {
			if (!this.s3) {
				return false
			}

			const params = {
				Bucket: this.bucketId,
				Prefix: path,
				ContinuationToken: token,
			}

			try {
				const listCommand = new ListObjectsV2Command(params)

				const list = await this.s3.send(listCommand)

				if (list.NextContinuationToken) {
					await recursiveDelete(path, list.NextContinuationToken)
				}

				if (list.KeyCount && list.Contents) {
					const deleteCommand = new DeleteObjectsCommand({
						Bucket: this.bucketId,
						Delete: {
							Objects: list.Contents.map((item) => ({ Key: item.Key ?? "" })),
						},
					})

					await this.s3.send(deleteCommand)
				}
			} catch (e) {
				logger.log("error", e)
				if (e instanceof S3ServiceException) {
					devLog(e.message)
				}
				return false
			}

			return true
		}

		return await recursiveDelete(path, undefined)
	}
}
