// @ts-nocheck

import e from "cors"
import { Request, Response } from "express"
import Stripe from "stripe"
import { logger } from "../../../modules/logger"
import { getCollection } from "../../../modules/mongo"
import { ajv, validateSchema } from "../../../util/validation"
import { getCustomerIdFromUser, getStripe } from "./subscriptions.core"
import { stripePrices } from "./subscriptions.utils"
import { config } from "../../../modules/config"

export const generateSubscribeSession = async (req: Request, res: Response) => {
	if (getStripe() === undefined) {
		res.status(404).send("API is not Stripe enabled")
		return
	}

	if (!stripePrices().includes(req.body.price)) {
		res.status(400).send("Invalid price")
		return
	}

	// Limit number of subscribers for initial release(s)
	const subConfig = config().subscription!
	if (subConfig.stripeMaxSubs) {
		const maxSubs = subConfig.stripeMaxSubs
		if (maxSubs > 0) {
			const numSubs: number = await getCollection("subscribers").countDocuments({ subscriptionId: { $ne: null } })
			if (numSubs >= maxSubs) {
				res.status(401).send(`${subConfig.name} is currently limiting the amount of subscribers. The limit has been reached, try again when ${subConfig.name} is fully released.`)
				return
			}
		}
	}

	const price = req.body.price
	const customer = await getCustomerIdFromUser(res.locals.uid, true)

	if (customer) {
		const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
		if (subscriber) {
			if (subscriber.subscriptionId) {
				res.status(403).send("Subscription already active, cannot create a checkout session while a subscription is active.")
				return
			}
		}

		const stripe = getStripe()!
		const sessions = stripe.checkout.sessions
		const session = await sessions
			.create({
				customer: customer.id,
				line_items: [
					{
						price: price,
						quantity: 1,
					},
				],

				mode: "subscription",
				success_url: `${subConfig.plusRootUrl}#success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${subConfig.plusRootUrl}#dashboard`,
				client_reference_id: res.locals.uid,

				phone_number_collection: { enabled: false },

				managed_payments: {
					enabled: true,
				},
				metadata: {
					uid: res.locals.uid,
				},
			})
			.catch((e) => {
				if (config().development) {
					console.log(e)
				}
			})

		if (session !== undefined) {
			logger.info(JSON.stringify(session))
			res.status(200).send({ url: session.url, id: session.id })
		} else {
			res.status(500).send("Something went wrong trying to create checkout session")
		}
	} else {
		res.status(500).send("Unable to find or create a new customer")
	}
}

const s_validateSubscribeSessionsSchema = {
	type: "object",
	properties: {
		price: {
			type: "string",
		},
	},
	nullable: false,
	additionalProperties: false,
	required: ["price"],
}
const v_validateSubscribeSessionsSchema = ajv.compile(s_validateSubscribeSessionsSchema)

export const validateSubscribeSessionsSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateSubscribeSessionsSchema, body)
}
