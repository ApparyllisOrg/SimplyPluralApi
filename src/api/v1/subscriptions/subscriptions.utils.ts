import { Stripe } from "stripe"

export const isSubscriptionCancelled = (subscription: Stripe.Subscription | undefined): boolean => {
	return !!subscription && (subscription.cancel_at_period_end === true || (subscription.cancel_at ? true : false))
}

export const stripePricesQuery = () => `active:'true' AND product:'${process.env.STRIPE_PLUS_PRODUCT}'`
export const stripePrices = () => process.env.STRIPE_PRICES!.split(",")
