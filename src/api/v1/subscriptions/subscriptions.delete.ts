import { Request, Response } from "express"
import { getStripe } from "./subscriptions.core"
import { getCollection } from "../../../modules/mongo"
import { sendSimpleEmail } from "../../../modules/mail"
import { mailTemplate_cancelledSubscription } from "../../../modules/mail/mailTemplates"
import { isSubscriptionCancelled } from "./subscriptions.utils"

export const deleteAllSubscriptions = async (uid: string) => {
	if (getStripe() === undefined) {
		return
	}

	const subscriber = await getCollection("subscribers").findOne({ uid })
	if (subscriber) {
		if (subscriber.cancelled === true) {
			return
		}

		if (!subscriber.subscriptionId) {
			return
		}

		const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, { cancel_at_period_end: true, cancellation_details: { feedback: "other", comment: "Cancelled due to account removal" } })
		if (isSubscriptionCancelled(result)) {
			sendSimpleEmail(uid, mailTemplate_cancelledSubscription(), "Your Simply Plus subscription is cancelled")
		}
	}
}
