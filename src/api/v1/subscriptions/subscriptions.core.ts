import express, { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import * as core from "express-serve-static-core";
import assert from "assert";
import { paddleCallback } from "./subscriptions.callback";
import { getCollection } from "../../../modules/mongo";
import axios from "axios";
import { getRequestPaddle, postRequestPaddle } from "./subscriptions.http";

let _paddleIsSetup = false
let _paddleURL = ''

export const setupPaddle = (app: core.Express) => {
    if (process.env.PADDLE_KEY != undefined) {
        assert(process.env.PADDLE_PRICE_A !== undefined);
        assert(process.env.PADDLE_PRICE_B !== undefined);
        assert(process.env.PADDLE_PRICE_C !== undefined);
        assert(process.env.PADDLE_URL !== undefined);
        assert(process.env.PADDLE_WEBHOOK_SECRET !== undefined);
        assert(process.env.PLUS_ROOT_URL !== undefined);

        // Handle webhook before we parse the body as json
        app.post("/v1/subscription/callback", express.raw({ type: 'application/json' }), paddleCallback)

        _paddleURL = process.env.PADDLE_URL
        _paddleIsSetup = true;
    }
}

export const isPaddleSetup = () => _paddleIsSetup;
export const getPaddleURL = () => {
    assert(isPaddleSetup())
    return _paddleURL
}
export const getPaddleKey = () => {
    assert(isPaddleSetup())
    return process.env.PADDLE_KEY
}

export const getCustomerIdFromUser = async (uid: string): Promise<any | undefined> => {
    let subscriber = await getCollection("subscribers").findOne({ uid })

    if (!subscriber) {
        return undefined
    }

    return subscriber.customerId
}