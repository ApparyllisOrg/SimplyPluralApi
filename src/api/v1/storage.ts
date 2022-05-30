import * as AWS from "aws-sdk";
import { Request, Response } from "express";
import { logger, userLog } from "../../modules/logger";
import { validateSchema } from "../../util/validation";
import * as minio from "minio";

const minioClient = new minio.Client({
    endPoint: 'localhost',
    port: 9001,
	useSSL: false,
    accessKey: process.env.MINIO_KEY!,
    secretKey: process.env.MINIO_SECRET!
});

export function Store(req: Request, res: Response) {
	const path = `avatars/${res.locals.uid}/${req.params.id}`;

	const buffer = Buffer.from(req.body["buffer"]);

	minioClient.putObject("spaces", path, buffer).catch((e) => {
		logger.error(e)
		res.status(500).send("Error uploading avatar");
	}).then(() =>{
		res.status(200).send({ success: true, msg: { url: "https://serve.apparyllis.com/avatars/" + path }})
		userLog(res.locals.uid, "Stored avatar with size: " + buffer.length);
	})
}

export const validateStoreAvatarSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			buffer: { type: "array", items: { type: "number", minimum: 0, maximum: 255 } },
		},
		nullable: false,
		additionalProperties: false,
	};

	return validateSchema(schema, body);
}

export function Delete(req: Request, res: Response) {
	const path = `avatars/${res.locals.uid}/${req.params.id}`;
	minioClient.removeObject("spaces",path).then(() => 
	{
		res.status(200).send({ success: true, msg: "" });
		userLog(res.locals.uid, "Deleted avatar");
		
	}).catch((e) => {
		logger.error(e)
		res.status(500).send("Error deleting file");
	})
}
