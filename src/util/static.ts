import { Request, Response } from "express"
import { getTemplate } from "../modules/mail/mailTemplates"

export const serveStatic = (template: string) => {
	return (_req: Request, res: Response) => {
		const html = getTemplate(template)

		res.header("Content-Type", "text/html").send(html)
	}
}