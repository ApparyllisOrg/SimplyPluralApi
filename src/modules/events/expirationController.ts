import { getCollection } from "../mongo"

export const expireDocuments = async () => 
{
    await getCollection("audit").deleteMany({exp: { $lte: Date.now() } })

    setTimeout(() => {
        expireDocuments()
    }, 60000);
} 