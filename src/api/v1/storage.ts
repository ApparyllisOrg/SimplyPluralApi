import * as AWS from "aws-sdk";
import { Request, Response } from "express";
import { userLog } from "../../modules/logger";

const spacesEndpoint = new AWS.Endpoint("sfo3.digitaloceanspaces.com");
const s3 = new AWS.S3({
	endpoint: spacesEndpoint,
	accessKeyId: process.env.SPACES_KEY,
	secretAccessKey: process.env.SPACES_SECRET,
});

export function Store(req: Request, res: Response) {
	const path = `avatars/${res.locals.uid}/${req.body["fileName"]}`;

	const buffer = Buffer.from(req.body["file"]);

	const params = {
		Bucket: "simply-plural",
		Key: path,
		Body: buffer,
		ACL: "public-read",
	};

	s3.putObject(params, function (err) {
		if (err) {
			res.status(500).send(err);
		} else {
			res.status(200).send({ success: true, msg: { url: "https://simply-plural.sfo3.digitaloceanspaces.com/" + path } });
		}
	});

	userLog(res.locals.uid, "Stored avatar with size: " + buffer.length);
}

export function Delete(req: Request, res: Response) {
	const path = `avatars/${res.locals.uid}/${req.body["fileName"]}`;

	const params = {
		Bucket: "simply-plural",
		Key: path,
	};

	s3.deleteObject(params, function (err) {
		if (err) {
			res.status(500).send(err);
		} else {
			res.status(200).send({ success: true, msg: "" });
		}
	});

	userLog(res.locals.uid, "Deleted avatar");
}