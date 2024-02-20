import { Request, Response } from "express";
import { getCustomerIdFromUser, isLemonSetup } from "./subscriptions.core";
import { getRequestLemon } from "./subscriptions.http";

export const getInvoices = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    let customer = await getCustomerIdFromUser(res.locals.uid)

    if (!customer) {
        res.status(404).send("No invoices found");
        return;
    }

    const customerResult = await getRequestLemon(`v1/customers/${customer}`)

    if (customerResult.success !== true)
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(customerResult)
        }
        res.status(500).send("Something went wrong trying to get your subscription invoices")
        return
    }

    const ordersResult = await getRequestLemon(`v1/orders?filter[user_email]=${customerResult.data.data.attributes.email}`)

    if (ordersResult.success !== true)
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(ordersResult)
        }
        res.status(500).send("Something went wrong trying to get your subscription invoices")
        return
    }

    const invoiceList: { name: string, total: number, subtotal: number, tax: number, orderNumber: number, taxRate: string, taxName: string, currency: string, time: number, url: string }[] = []

    const orders : any[] = ordersResult.data.data
    orders.forEach((order) =>
    {
        invoiceList.push({
                name: order.attributes.first_order_item.variant_name,
                total: order.attributes.total,
                subtotal: order.attributes.subtotal,
                tax: order.attributes.tax,
                orderNumber: order.attributes.order_number,
                currency: order.attributes.currency,
                taxRate: order.attributes.tax_rate,
                taxName: order.attributes.tax_name,
                time: new Date(order.attributes.created_at).getTime(),
                url: order.attributes.urls.receipt
            })
    })

    res.status(200).send(invoiceList)
};
