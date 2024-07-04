import * as minio from "minio";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logger } from "./logger";

const s3 = new S3Client({
	endpoint: process.env.OBJECT_HOST ?? "",
	region: process.env.OBJECT_REGION ?? "none",
	credentials: { accessKeyId: process.env.OBJECT_KEY ?? '', secretAccessKey: process.env.OBJECT_SECRET ?? ''}
});

const minioClient = new minio.Client({
	endPoint: "localhost",
	port: 9001,
	useSSL: false,
	accessKey: process.env.MINIO_KEY!,
	secretKey: process.env.MINIO_SECRET!,
});

//-------------------------------//
// Get a file from storage
//-------------------------------//
export const getFileFromStorage = async (path: string): Promise<Buffer | null> => {
	return new Promise<Buffer | null>(async (resolve, _reject) => {
		const params = {
			Bucket: "simply-plural",
			Key: path
		};
		try {
			const command = new GetObjectCommand(params);

			const file = await s3.send(command)
			if (file && file.Body) {
				const buffer = await file.Body.transformToByteArray()
				resolve(Buffer.from(buffer));
				return;
			}
		}
		catch (e) {
		}

		try {
			const file = await minioClient.getObject("spaces", path);

			const buffer: Buffer[] = [];

			file.on("data", function (chunk) {
				buffer.push(chunk);
			});
			file.on("end", function () {
				resolve(Buffer.concat(buffer));
			});
			file.on("error", function (_e) {
				resolve(null);
			});
		} catch (e) {
			logger.log("error", e)
			resolve(null);
		}
	});
};
