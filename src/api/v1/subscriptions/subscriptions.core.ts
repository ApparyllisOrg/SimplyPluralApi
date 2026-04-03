import Stripe from "stripe"
import express, { Request, Response } from "express"
import { getEmailForUser } from "../auth/auth.core"
import * as core from "express-serve-static-core"
import { stripeCallback } from "./subscriptions.callback"
import { getCollection } from "../../../modules/mongo"
import { config } from "../../../modules/config"

let _stripe: undefined | Stripe = undefined

export const initializeStripe = (app: core.Express) => {
	const subConfig = config().subscription
	if (subConfig) {
		// @ts-expect-error
		_stripe = new Stripe(subConfig.stripeKey, { apiVersion: "2025-09-30.clover; managed_payments_preview=v1;" })

		// Handle webhook before we parse the body as json
		app.post("/v1/subscription/callback", express.raw({ type: "application/json" }), stripeCallback)
	}
}

export const getStripe = () => _stripe
export const isStripeSetup = () => _stripe != undefined

export const getCustomerIdFromUser = async (uid: string, createIfMissing: boolean): Promise<Stripe.Customer | undefined> => {
	const subscriber = await getCollection("subscribers").findOne({ uid })

	let customer: Stripe.Customer | undefined = undefined

	if (!subscriber) {
		if (createIfMissing) {
			customer = await getStripe()?.customers.create({ metadata: { uid } })
			getCollection("subscribers").insertOne({ customerId: customer?.id, uid })
		}
	} else {
		const existingCustomer = await getStripe()?.customers.retrieve(subscriber.customerId)
		if (existingCustomer) {
			customer = existingCustomer as Stripe.Customer
		} else {
			return undefined
		}
	}

	return customer
}
