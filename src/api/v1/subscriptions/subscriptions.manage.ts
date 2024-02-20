import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { isLemonSetup } from "./subscriptions.core";

export const getManagementLink = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    if (subscriber && subscriber.subscriptionId) {
        //const session = await getStripe()?.billingPortal.sessions.create({ customer: subscriber.customerId, return_url: process.env.PLUS_ROOT_URL })
       // res.status(200).send(session?.url);
        return
    }
    res.status(404).send()
};
