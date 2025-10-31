import { Request, Response } from "express"
import { getStripe } from "./subscriptions.core"
import { getCollection } from "../../../modules/mongo"
import { sendCustomizedEmail, sendSimpleEmail } from "../../../modules/mail"
import { ajv, validateSchema } from "../../../util/validation"
import { getTemplate, mailTemplate_cancelledSubscription, mailTemplate_changedSubscription } from "../../../modules/mail/mailTemplates"
import assert from "node:assert"
import accounting from "accounting"
import getSymbolFromCurrency from "currency-symbol-map"
import { stripePrices, stripePricesQuery } from "./subscriptions.utils"

export const changeSubscription = async (req: Request, res: Response) => {
	if (getStripe() === undefined) {
		res.status(404).send("API is not Stripe enabled")
		return
	}

	if (!stripePrices().includes(req.body.price)) {
		res.status(400).send("Invalid price")
		return
	}

	const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
	if (subscriber) {
		if (!subscriber.subscriptionId) {
			res.status(404).send()
			return
		}

		const existingSubscription = await getStripe()?.subscriptions.retrieve(subscriber.subscriptionId)
		assert(existingSubscription)

		const queriedPrices = await getStripe()?.prices.search({ query: stripePricesQuery() })

		const activePrice = queriedPrices?.data.find((price) => price.id === existingSubscription.items.data[0].price.id)

		if (!activePrice) {
			res.status(500).send("Failed to find active subscription price")
			return
		}

		const targetPrice = queriedPrices?.data.find((price) => price.id === req.body.price)

		if (!targetPrice) {
			res.status(400).send("Failed to find target price")
			return
		}

		if (!stripePrices().includes(targetPrice.id)) {
			res.status(400).send("Failed to target specified price")
			return
		}

		if (targetPrice === activePrice) {
			res.status(400).send("Cannot change to the same price")
			return
		}

		if (targetPrice.recurring?.interval !== activePrice.recurring?.interval) {
			res.status(400).send("Failed to target specified price")
			return
		}

		const result = await getStripe()?.subscriptions.update(subscriber.subscriptionId, {
			proration_behavior: "none",
			items: [
				{
					id: existingSubscription.items.data[0].id,
					price: req.body.price,
				},
			],
		})

		if (!result) {
			res.status(500).send("Something went wrong updating your subscription.")
			return
		}

		assert(result?.items.data[0].price.id == req.body.price)
		res.status(200).send("Changed subscription")

		let emailTemplate = await getTemplate(mailTemplate_changedSubscription())

		const priceValue = result?.items.data[0].price.unit_amount! * 0.01
		const currency = result.currency
		emailTemplate = emailTemplate.replace("{{newPrice}}", `${accounting.formatMoney(priceValue, getSymbolFromCurrency(currency), 2)}`)

		sendCustomizedEmail(res.locals.uid, emailTemplate, "Your Simply Plus subscription has changed")
	} else {
		res.status(404).send()
	}
}

const s_validateChangeSubscriptionSchema = {
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
const v_validateChangeSubscriptionSchema = ajv.compile(s_validateChangeSubscriptionSchema)

export const validateChangeSubscriptionSchema = (body: unknown): { success: boolean; msg: string } => {
	return validateSchema(v_validateChangeSubscriptionSchema, body)
}
