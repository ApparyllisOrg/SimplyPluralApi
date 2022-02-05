import nodemailer, { Transporter } from "nodemailer"
import SMTPTransport from "nodemailer/lib/smtp-transport"

export let mailerTransport: null | Transporter<SMTPTransport.SentMessageInfo> = null

export const startMailTransport = async () => {
	mailerTransport = nodemailer.createTransport({
		host: "smtp.apparyllis.com",
		port: 465,
		secure: true,
		auth: {
			user: process.env.MAILUSER,
			pass: process.env.MAILPASSWORD,
		},
		tls: {
			ciphers: 'SSLv3'
		}
	})

	mailerTransport.verify().catch((e) => console.log(e))
}