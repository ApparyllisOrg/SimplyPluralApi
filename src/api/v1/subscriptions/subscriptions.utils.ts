import { Stripe } from "stripe"
import { config } from "../../../modules/config"

export const isSubscriptionCancelled = (subscription: Stripe.Subscription | undefined): boolean => {
	return !!subscription && (subscription.cancel_at_period_end === true || (subscription.cancel_at ? true : false))
}

export const stripePricesQuery = () => `active:'true' AND product:'${config().subscription!.stripePlusProduct}'`
export const stripePrices = () => config().subscription!.stripePrices
