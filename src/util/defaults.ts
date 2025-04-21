import { Request, Response } from "express"
import { getCollection } from "../modules/mongo"

export const insertDefaultUserColor = async (req: Request, res: Response) => {
	if (req.body.color === undefined) {
		const user = await getCollection("users").findOne({ _id: res.locals.uid, uid: res.locals.uid })
		if (user && user.color) {
			req.body.color = user.color
		} else {
			req.body.color = "#D5AF63"
		}
	}
}
