import express from "express";
import * as core from "express-serve-static-core";
import assert from "assert";
import { lemonCallback } from "./subscriptions.callback";
import { getCollection } from "../../../modules/mongo";

let _lemonIsSetup = false
let _lemonURL = ''

export const setupLemon = (app: core.Express) => {
    if (process.env.LEMON_KEY != undefined) {
        assert(process.env.LEMON_PRICE_A !== undefined);
        assert(process.env.LEMON_PRICE_B !== undefined);
        assert(process.env.LEMON_PRICE_C !== undefined);
        assert(process.env.LEMON_PRICE_X !== undefined);
        assert(process.env.LEMON_URL !== undefined);
        assert(process.env.LEMON_WEBHOOK_SECRET !== undefined);
        assert(process.env.PLUS_ROOT_URL !== undefined);
        assert(process.env.LEMON_HMAC_KEY !== undefined);
        assert(process.env.LEMON_STORE_ID !== undefined)

        // Handle webhook before we parse the body as json
        app.post("/v1/subscription/callback", express.raw({ type: 'application/json' }), lemonCallback)

        _lemonURL = process.env.LEMON_URL
        _lemonIsSetup = true;
    }
}

export const isLemonSetup = () => _lemonIsSetup;
export const getLemonURL = () => {
    assert(isLemonSetup())
    return _lemonURL
}
export const getLemonKey = () => {
    assert(isLemonSetup())
    return process.env.LEMON_KEY
}

export const getCustomerIdFromUser = async (uid: string): Promise<any | undefined> => {
    let subscriber = await getCollection("subscribers").findOne({ uid })

    if (!subscriber) {
        return undefined
    }

    return subscriber.customerId
}