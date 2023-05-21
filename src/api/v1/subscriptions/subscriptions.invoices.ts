import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { fetchCollection, sendDocuments, transformResultForClientRead } from "../../../util";

export const getInvoices = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    req.query.sortBy = "time"
    req.query.sortOrder = "-1";

    fetchCollection(req, res, "invoices", {})
};
