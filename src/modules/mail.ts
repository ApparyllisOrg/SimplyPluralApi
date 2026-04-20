import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { getEmailForUser } from "../api/v1/auth/auth.core";
import { getTemplate } from "./mail/mailTemplates";
import promclient from "prom-client";
import Mail from "nodemailer/lib/mailer";
import { logger } from "./logger";
import { config } from "./config";

let mailerTransport: null | Transporter<SMTPTransport.SentMessageInfo> = null;

const friendlyMailError = (reason: any): Error => {
	const responseCode: number | undefined = reason?.responseCode

	const GENERIC_ERROR = (errorCode : number ) => new Error(`The email failed to send, please try again later. Error(${errorCode})`)

	if (responseCode) {
		if (responseCode === 452 || responseCode === 552) return new Error("Your mailbox might be full. Please free up space and try again.")
		if (responseCode === 550) return new Error("Your email address could not receive this message. Please check your account email address.")
		if (responseCode === 501 || responseCode === 510 || responseCode === 511 || responseCode === 512 || responseCode === 551 || responseCode === 553) return new Error("The email address is invalid.")
		if (responseCode >= 500) return GENERIC_ERROR(responseCode)
		if (responseCode >= 400) return GENERIC_ERROR(responseCode)
	}

	return GENERIC_ERROR(0)
}

export const startMailTransport = async () => {
	const mailConfig = config().mail
	if (!mailConfig) {
		console.log("Mail not configured, skipping SMTP transport")
		return
	}

	mailerTransport = nodemailer.createTransport({
		host: mailConfig.host,
		port: mailConfig.port,
		secure: true,
		auth: {
			user: mailConfig.user,
			pass: mailConfig.password,
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
	if (config().unitTest) return
	
	let emailTemplate = getTemplate(templateName);

	const userEmail = await getEmailForUser(uid);

	const res = await mailerTransport
		?.sendMail({
			from: config().mail!.sender,
			to: userEmail,
			html: emailTemplate,
			cc: cc,
			subject: title,
			attachments: attachements
		})
		.catch((reason): Error => {
			logger.log("error", reason)
			return friendlyMailError(reason)
		});

	transaction_mail_counter.inc();

	return res;
}

export const sendCustomizedEmail = async (uid: string, email: string, title: string, cc?: string[] | undefined, attachements?: Mail.Attachment[]) => {
	if (config().unitTest) return

	const userEmail = await getEmailForUser(uid);

	const res = await mailerTransport
		?.sendMail({
			from: config().mail!.sender,
			to: userEmail,
			html: email,
			cc: cc,
			subject: title,
			attachments: attachements
		})
		.catch((reason): Error => {
			logger.log("error", reason)
			return friendlyMailError(reason)
		});

	transaction_mail_counter.inc();

	return res;
}

export const sendCustomizedEmailToEmail = async (userMail: string, email: string, title: string, cc?: string[] | undefined) => {
	if (config().unitTest) return

	const res = await mailerTransport
		?.sendMail({
			from: config().mail!.sender,
			to: userMail,
			html: email,
			cc: cc,
			subject: title,
		})
		.catch((reason): Error => {
			logger.log("error", reason)
			return friendlyMailError(reason)
		});

	transaction_mail_counter.inc();

	return res;
}