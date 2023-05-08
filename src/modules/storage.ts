import * as minio from "minio";
import * as AWS from "aws-sdk";
import { S3 } from "aws-sdk";

const objectEndpoint = new AWS.Endpoint(process.env.OBJECT_HOST ?? "");
const s3 = new AWS.S3({
	endpoint: objectEndpoint,
	accessKeyId: process.env.OBJECT_KEY,
	secretAccessKey: process.env.OBJECT_SECRET,
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
export const getFileFromStorage = async (path: string): Promise<Buffer[] | null | S3.Body> => {
	return new Promise<Buffer[] | null | S3.Body>(async (resolve, _reject) => {
		const params = {
			Bucket: "simply-plural",
			Key: path
		};
		try {
			const file = await s3.getObject(params).promise();
			if (file && file.Body) {
				resolve(file.Body);
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
				resolve(buffer);
			});
			file.on("error", function (_e) {
				resolve(null);
			});
		} catch (e) {
			console.log(e);
			resolve(null);
		}
	});
};
