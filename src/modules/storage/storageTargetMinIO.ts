import { Client } from "minio"
import * as minio from "minio"
import { logger } from "../logger"
import { StoragePutOptions, StorageTarget } from "./storageTarget"

export class StorageTargetMinIO implements StorageTarget {
	private minioClient: Client | undefined
	private bucketId: string

	constructor(bucketId: string) {
		this.bucketId = bucketId
	}

	init(endpoint: string, port: number, accessKey: string, secret: string) {
		this.minioClient = new minio.Client({
			endPoint: endpoint,
			port: port,
			useSSL: false,
			accessKey: accessKey,
			secretKey: secret,
		})
	}

	async get(path: string): Promise<Buffer | undefined> {
		return new Promise<Buffer | undefined>(async (resolve, _reject) => {
			if (!this.minioClient) {
				return undefined
			}

			try {
				const file = await this.minioClient.getObject(this.bucketId, path)

				const buffer: Buffer[] = []

				file.on("data", function (chunk) {
					buffer.push(chunk)
				})
				file.on("end", function () {
					resolve(Buffer.concat(buffer))
				})
				file.on("error", function (_e) {
					resolve(undefined)
				})
			} catch (e) {
				logger.log("error", e)
				resolve(undefined)
			}
		})
	}

	async put(path: string, buffer: Buffer, options: StoragePutOptions | undefined): Promise<boolean> {
		throw new Error("MinIO should not be used to put any files, this is currently in backwards legacy support mode!")
	}

	async delete(path: string): Promise<boolean> {
		return new Promise<boolean>(async (resolve, _reject) => {
			if (!this.minioClient) {
				return false
			}

			this.minioClient
				.removeObject(this.bucketId, path)
				.then(() => {
					resolve(true)
				})
				.catch((e) => {
					logger.error(e)
					resolve(false)
				})
		})
	}

	async deleteFolder(path: string): Promise<boolean> {
		return new Promise<boolean>(async (resolve, _reject) => {
			if (!this.minioClient) {
				return false
			}
			const listedObjects = await this.minioClient.listObjectsV2(this.bucketId, path)
			if (listedObjects) {
				const list: minio.BucketItem[] = []
				const toDeleteList: string[] = []

				listedObjects.on("data", function (item) {
					list.push(item)
				})

				listedObjects.on("error", function () {
					resolve(false)
				})

				const end = async () => {
					list.forEach(({ name }) => {
						if (name) {
							toDeleteList.push(name)
						}
					})

					if (!this.minioClient) {
						return false
					}

					await this.minioClient.removeObjects(this.bucketId, toDeleteList)

					resolve(true)
				}

				listedObjects.on("end", end)
			}
		})
	}
}
