import { readFile } from "node:fs";
import { promisify } from "node:util";
import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { getEmailForUser } from "../api/v1/auth/auth.core";

export let mailerTransport: null | Transporter<SMTPTransport.SentMessageInfo> = null;

export const startMailTransport = async () => {
	mailerTransport = nodemailer.createTransport({
		host: process.env.MAILHOST,
		port: Number(process.env.MAILPORT),
		secure: true,
		auth: {
			user: process.env.MAILUSER,
			pass: process.env.MAILPASSWORD,
		},
		tls: {
			ciphers: "SSLv3",
		},
	});

	mailerTransport
		.verify()
		.catch((e) => console.log(e))
		.then(() => console.log("SMTP connection live"));
};

export const sendSimpleEmail = async (uid: string, fileName: string, title: string) => {
	const getFile = promisify(readFile);
	let emailTemplate = await getFile(fileName, "utf-8");

	const userEmail = await getEmailForUser(uid);

	await mailerTransport
		?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: userEmail,
			html: emailTemplate,
			subject: title,
		})
		.catch((reason) => {
			console.log(reason)
		});
}