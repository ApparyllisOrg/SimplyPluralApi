
import { Request, Response } from "express";
import { getCollection } from "../../../modules/mongo";
import { isCatSetup } from "./subscriptions.core";
import { transformResultForClientRead } from "../../../util";

export const getSubscription = async (req: Request, res: Response) => {
    if (!isCatSetup()) {
        res.status(404).send("API is not cat enabled");
        return
    }

    const subscriber = await getCollection("subscribers").findOne({ uid: res.locals.uid })
    res.status(200).send(transformResultForClientRead(subscriber, res.locals.uid))
};
