import Stripe from "stripe";
import { Request, Response } from "express";
import { getEmailForUser } from "../auth/auth.core";
import assert from "assert";
import { validateSchema } from "../../../util/validation";
import { getCustomerIdFromUser, getStripe } from "./subscriptions.core";
import { getCollection } from "../../../modules/mongo";
import { fetchCollection, sendDocuments, transformResultForClientRead } from "../../../util";
import { client_result } from "../../../util/types";

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

    const invoiceList: client_result<{ uid: string, customerId: string, invoiceId: string, currency: string, price: number, url: string, time: number, subscriptionId: string }>[] = []

    invoices?.data.forEach((invoice) => {
        if (!invoice.hosted_invoice_url) {
            return;
        }

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
                url: invoice.hosted_invoice_url
            }
        })
    })

    res.status(200).send(invoiceList);
};
