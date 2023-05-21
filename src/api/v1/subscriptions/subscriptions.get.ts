import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { transformResultForClientRead } from "../../../util";

export const getSubscription = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber !== undefined) {
        const response = transformResultForClientRead(subscriber, res.locals.uid)
        res.status(200).send(response)
    }
    else {
        res.status(404).send()
    }
};
