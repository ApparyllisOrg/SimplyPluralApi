import { Request, Response } from "express"
import { getStripe } from "./subscriptions.core"
import { stripePrices, stripePricesQuery } from "./subscriptions.utils"

export const getPrices = async (req: Request, res: Response) => {
	if (getStripe() === undefined) {
		res.status(404).send("API is not Stripe enabled")
		return
	}

	const prices = await getStripe()?.prices.search({ query: stripePricesQuery() })
	if ((prices?.data.length ?? 0) > 0) {
		const priceData: {
			priceId: string
			currency: string
			value: number
			name: string
			style: string
			interval: string
		}[] = []

		prices?.data.forEach((price, index) => {
			if (stripePrices().includes(price.id)) {
				priceData.push({
					priceId: price.id,
					currency: price.currency,
					value: price.unit_amount ?? 0,
					name: price.metadata["name"],
					style: price.metadata["style"],
					interval: price.recurring?.interval ?? "err",
				})
			}
		})

		res.status(200).send(priceData)
	} else {
		res.status(500)
	}
}
