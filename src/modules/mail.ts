import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { getEmailForUser } from "../api/v1/auth/auth.core";
import { getTemplate } from "./mail/mailTemplates";
import promclient from "prom-client";
import Mail from "nodemailer/lib/mailer";
import { logger } from "./logger";

let mailerTransport: null | Transporter<SMTPTransport.SentMessageInfo> = null;

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
		.catch((e) => logger.log("error", e))
		.then(() => console.log("SMTP connection live"));
};

const transaction_mail_counter = new promclient.Counter({
	name: "apparyllis_transactional_mails",
	help: "Amount of transactional mails sent",
});

export const sendSimpleEmail = async (uid: string, templateName: string, title: string, cc?: string[] | undefined, attachements?: Mail.Attachment[]) => {
	let emailTemplate = getTemplate(templateName);

	const userEmail = await getEmailForUser(uid);

	const res = await mailerTransport
		?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: userEmail,
			html: emailTemplate,
			cc: cc,
			subject: title,
			attachments: attachements
		})
		.catch((reason) => {
			logger.log("error", reason)
		});

	transaction_mail_counter.inc();

	return res;
}

export const sendCustomizedEmail = async (uid: string, email: string, title: string, cc?: string[] | undefined, attachements?: Mail.Attachment[]) => {
	const userEmail = await getEmailForUser(uid);

	const res = await mailerTransport
		?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: userEmail,
			html: email,
			cc: cc,
			subject: title,
			attachments: attachements
		})
		.catch((reason) => {
			logger.log("error", reason)
		});

	transaction_mail_counter.inc();

	return res;
}

export const sendCustomizedEmailToEmail = async (userMail: string, email: string, title: string, cc?: string[] | undefined) => {
	const res = await mailerTransport
		?.sendMail({
			from: '"Apparyllis" <noreply@apparyllis.com>',
			to: userMail,
			html: email,
			cc: cc,
			subject: title,
		})
		.catch((reason) => {
			logger.log("error", reason)
		});

	transaction_mail_counter.inc();

	return res;
}