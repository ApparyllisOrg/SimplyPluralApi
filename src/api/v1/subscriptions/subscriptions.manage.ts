import { Request, Response } from "express"
import { getCollection } from "../../../modules/mongo"
import { getStripe } from "./subscriptions.core"
import { config } from "../../../modules/config"

export const getManagementLink = async (req: Request, res: Response) => {
	if (getStripe() === undefined) {
		res.status(404).send("API is not Stripe enabled")
		return
	}

	const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
	if (subscriber && subscriber.subscriptionId) {
		const session = await getStripe()?.billingPortal.sessions.create({ customer: subscriber.customerId, return_url: config().subscription!.plusRootUrl })
		res.status(200).send(session?.url)
		return
	}
	res.status(404).send()
}
