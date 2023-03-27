import { Request, Response } from "express";
import { logger, userLog } from "../../modules/logger";
import { validateSchema } from "../../util/validation";
import * as minio from "minio";
import { isUserVerified } from "../../security";
import { getCollection } from "../../modules/mongo";
import moment from "moment";

const tracePerformance = process.env.TRACEPERFORMANCE == "true";

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
	const now = moment.now();

	minioClient
		.putObject("spaces", path, buffer)
		.catch((e) => {
			logger.error(e);
		})
		.then((onfullfilled: void | minio.UploadedObjectInfo) => {
			if (onfullfilled) {
				const diff = (moment.now() - now) / 1000;

				if (tracePerformance) {
					getCollection("performanceTrace").insertOne({ type: "upload", bytes: buffer.byteLength, duration: diff });
				}

				res.status(200).send({ success: true, msg: { url: "https://serve.apparyllis.com/avatars/" + path } });
				userLog(res.locals.uid, "Stored avatar with size: " + buffer.length);
			} else {
				res.status(500).send("Error uploading avatar");
			}
		});
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
	minioClient
		.removeObject("spaces", path)
		.then(() => {
			res.status(200).send({ success: true, msg: "" });
			userLog(res.locals.uid, "Deleted avatar");
		})
		.catch((e) => {
			logger.error(e);
			res.status(500).send("Error deleting file");
		});
};
