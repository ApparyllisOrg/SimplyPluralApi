
import { Request, Response } from "express";
import { isLemonSetup } from "./subscriptions.core";
import { getRequestLemon } from "./subscriptions.http";

export const getSubscriptionOptions = async (req: Request, res: Response) => {
    if (!isLemonSetup()) {
        res.status(404).send("API is not Lemon enabled");
        return
    }

    const variantsResult = await getRequestLemon(`v1/variants?filter[product_id]=${process.env.LEMON_SP_PRODUCT}`)

    if (variantsResult.success !== true)
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(variantsResult)
        }
        res.status(500).send("Something went wrong trying to subscription options")
        return
    }

    const clientVariants : any[] = []
    
    const variants : {id: string, attributes: {price: number, name: string}}[] = variantsResult.data.data;
    variants.forEach((variant) => {
        clientVariants.push({id: variant.id, name: variant.attributes.name, price: variant.attributes.price})
    })

    res.status(200).send(clientVariants)
};
