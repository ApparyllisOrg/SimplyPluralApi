import express from "express";
import * as core from "express-serve-static-core";
import assert from "assert";
import {  catCallback } from "./subscriptions.callback";
import { getCollection } from "../../../modules/mongo";

let _catIsSetup = false

export const setupCat = (app: core.Express) => {
    if (process.env.CAT_WEBHOOK_SECRET !== undefined) {

        // Handle webhook before we parse the body as json
        app.post("/v1/subscription/callback", express.raw({ type: 'application/json' }), catCallback)

        _catIsSetup = true;
    }
}

export const isCatSetup = () => _catIsSetup;

export const getCustomerFromUser = async (uid: string): Promise<any | undefined> => {
    let subscriber = await getCollection("subscribers").findOne({ uid })

    if (!subscriber) {
        return undefined
    }

    return subscriber 
}