import { Request, Response } from "express"
import assert from "assert"
import { getStripe } from "./subscriptions.core"
import { getCollection } from "../../../modules/mongo"
import { client_result } from "../../../util/types"
import { isSubscriptionCancelled } from "./subscriptions.utils"
import { now } from "moment"

export const getSubscription = async (req: Request, res: Response) => {
	if (getStripe() === undefined) {
		res.status(404).send("API is not Stripe enabled")
		return
	}

	const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
	if (subscriber && subscriber.subscriptionId) {
		const subscription = await getStripe()?.subscriptions.retrieve(subscriber.subscriptionId)
		if (subscription) {
			assert(subscription.items.data.length == 1)
			const item = subscription.items.data[0]

			const response: client_result<{ price: number; currency: string; periodEnd: number; periodStart: number; subscriptionStart: number; priceId: string; cancelled: boolean; subscribed: boolean }> = {
				id: subscription.id,
				exists: true,
				content: {
					price: item.price.unit_amount ?? 0,
					currency: item.price.currency,
					periodEnd: item.current_period_end,
					periodStart: item.current_period_start,
					subscriptionStart: subscription.start_date,
					priceId: item.price.id,
					cancelled: isSubscriptionCancelled(subscription),
					subscribed: item.current_period_end > now() / 1000,
				},
			}
			res.status(200).send(response)
			return
		}
	}
	res.status(404).send()
}
