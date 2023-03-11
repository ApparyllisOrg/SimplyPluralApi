import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

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
