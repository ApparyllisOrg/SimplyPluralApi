import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getCustomerIdFromUser, getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { fetchCollection, sendDocuments, transformResultForClientRead } from "../../../util";

export const getInvoices = async (req: Request, res: Response) => {
    if (getStripe() === undefined) {
        res.status(404).send("API is not Stripe enabled");
        return
    }

    let customer = await getCustomerIdFromUser(res.locals.uid, false)

    if (!customer) {
        res.status(404).send("No invoices found");
        return;
    }

    const invoices = await getStripe()?.invoices.list({ customer: customer.id })

    const invoiceList: { exists: boolean, id: string, content: { uid: string, customerId: string, invoiceId: string, currency: string, price: Number, url: string, time: Number, subscriptionId: string } }[] = []

    invoices?.data.forEach((invoice) => {
        invoiceList.push({
            exists: true,
            id: invoice.id,
            content: {
                uid: res.locals.uid,
                customerId: invoice.customer as string,
                invoiceId: invoice.id,
                currency: invoice.currency,
                price: invoice.total,
                subscriptionId: invoice.subscription as string,
                time: invoice.created,
                url: invoice.hosted_invoice_url ?? ''
            }
        })
    })

    res.status(200).send(invoiceList);
};
