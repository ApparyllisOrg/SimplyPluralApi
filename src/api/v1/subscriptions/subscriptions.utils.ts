import * as Sentry from "@sentry/node";
import { ERR_SUBSCRIPTION_LEMON } from "../../../modules/errors";

export const priceIdToName = (id: string) => {
    switch (id) {
        case process.env.LEMON_PRICE_A!: {
            return "affordable";
        }
        case process.env.LEMON_PRICE_B!: {
            return "regular";
        }
        case process.env.LEMON_PRICE_C!: {
            return "pif";
        }
        case process.env.LEMON_PRICE_X!: {
            return "pwyw";
        }
    }

    return "err";
}

export const nameToPriceId = (name: string) => {
    switch (name) {
        case "affordable": {
            return process.env.LEMON_PRICE_A!;
        }
        case "regular": {
            return process.env.LEMON_PRICE_B!;
        }
        case "pif": {
            return process.env.LEMON_PRICE_C!;
        }
        case "pwyw": {
            return process.env.LEMON_PRICE_X!;
        }
    }

    return "err";
}

export const reportLemonError = (uid: string, context: string) => 
{
    Sentry.captureMessage(`ErrorCode(${ERR_SUBSCRIPTION_LEMON}) During: ${context}`, (scope) => {
        scope.setExtra("payload", uid);
        return scope;
    });
}

export const getLemonStoreRelationship = () => 
{
  return {
    data: {
        type: "stores",
        id: process.env.LEMON_STORE_ID
    }
  }
}
