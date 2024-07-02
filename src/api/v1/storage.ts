import { Request, Response } from "express";
import { logger, userLog } from "../../modules/logger";
import { validateSchema } from "../../util/validation";
import * as minio from "minio";
import { isUserVerified } from "../../security";
const fileType = require('file-type');

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
	endpoint: process.env.OBJECT_HOST ?? "",
	region: process.env.OBJECT_REGION ?? "",
	credentials: { accessKeyId: process.env.OBJECT_KEY ?? '', secretAccessKey: process.env.OBJECT_SECRET ?? ''}
});

const minioClient = new minio.Client({
	endPoint: "localhost",
	port: 9001,
	useSSL: false,
	accessKey: process.env.MINIO_KEY!,
	secretKey: process.env.MINIO_SECRET!,
});


export const Store = async (req: Request, res: Response) => {
	const result = await isUserVerified(res.locals.uid);
	if (result === false) {
		res.status(403).send("You need to verify your account to upload images");
		return false;
	}

	const path = `avatars/${res.locals.uid}/${req.params.dashedid}`;

	const buffer = Buffer.from(req.body["buffer"]);

	const resolvedFileType = await fileType.fromBuffer(buffer)

	if (!resolvedFileType)
	{
		res.status(400).send("File type cannot be detected from the file, try using another picture.");
		return false;
	}

	const mime = resolvedFileType.mime;
	const validMime = mime === "image/png" || mime === "image/jpeg";
	if (!validMime)
	{
		res.status(400).send(`File type not valid. Only JPG and PNG are supported. Your file type is ${mime}`);
		return false;
	}

	const params = {
		Bucket: "simply-plural",
		Key: path,
		Body: buffer,
	};

	try {
		const command = new PutObjectCommand(params);

		const result = await s3.send(command)

		if (result) {
			res.status(200).send({ success: true, msg: { url: "https://serve.apparyllis.com/avatars/" + path } });
			userLog(res.locals.uid, "Stored avatar with size: " + buffer.length);
			return;
		}
	}
	catch (e)
	{
		logger.log("error", e)
		res.status(500).send("Error uploading avatar");
	}
};

export const validateStoreAvatarSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			buffer: { type: "array", items: { type: "number", minimum: 0, maximum: 255 } },
		},
		nullable: false,
		required: ["buffer"],
		additionalProperties: false,
	};

	return validateSchema(schema, body);
};

export const Delete = async (req: Request, res: Response) => {
	const result = await isUserVerified(res.locals.uid);
	if (result === false) {
		res.status(403).send("You need to verify your account to delete images");
		return false;
	}

	const path = `avatars/${res.locals.uid}/${req.params.dashedid}`;

	const params = {
		Bucket: "simply-plural",
		Key: path,
	};

	minioClient
	.removeObject("spaces", path)
	.then(() => {
		userLog(res.locals.uid, "Deleted avatar");
	})
	.catch((e) => {
		logger.error(e);
	});

	try {
		const command = new DeleteObjectCommand(params);

		const result = await s3.send(command)
		if (result) {
			res.status(200).send('Deleted avatar');
			userLog(res.locals.uid, "Deleted avatar");
		}
	}
	catch (e)
	{
		logger.log("error", e)
		res.status(500).send("Error uploading avatar");
	}
};
