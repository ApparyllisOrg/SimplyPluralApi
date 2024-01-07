import * as Sentry from "@sentry/node";
import { ERR_SUBSCRIPTION_PADDLE } from "../../../modules/errors";

export const priceIdToName = (id: string) => {
    switch (id) {
        case process.env.STRIPE_PRICE_A!: {
            return "affordable";
        }
        case process.env.STRIPE_PRICE_B!: {
            return "regular";
        }
        case process.env.STRIPE_PRICE_C!: {
            return "pif";
        }
    }

    return "err";
}

export const nameToPriceId = (name: string) => {
    switch (name) {
        case "affordable": {
            return process.env.STRIPE_PRICE_A!;
        }
        case "regular": {
            return process.env.STRIPE_PRICE_B!;
        }
        case "pif": {
            return process.env.STRIPE_PRICE_C!;
        }
    }

    return "err";
}

export const reportPaddleError = (uid: string, context: string) => 
{
    Sentry.captureMessage(`ErrorCode(${ERR_SUBSCRIPTION_PADDLE}) During: ${context}`, (scope) => {
        scope.setExtra("payload", uid);
        return scope;
    });
}
