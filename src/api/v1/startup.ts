import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { transformResultForClientRead } from "../../util";

export const getStartupData = async (req: Request, res: Response) => {

    const getPromises = []
    getPromises.push(getCollection("members").find({ uid: res.locals.uid }).toArray())
    getPromises.push(getCollection("groups").find({ uid: res.locals.uid }).toArray())
    getPromises.push(getCollection("frontStatuses").find({ uid: res.locals.uid }).toArray())
    getPromises.push(getCollection("fronters").find({ uid: res.locals.uid }).toArray())
    getPromises.push(getCollection("channels").find({ uid: res.locals.uid }).toArray())

    const promiseResults = await Promise.all(getPromises)

    const members = promiseResults[0];
    const groups = promiseResults[1];
    const customFronts = promiseResults[2];
    const fronters = promiseResults[3];
    const channels = promiseResults[4];

    const constructDocumentsForClientRead = (documents: any[], ) =>
    {
        const returnDocuments: any[] = [];

        for (let i = 0; i < documents.length; ++i) {
            returnDocuments.push(transformResultForClientRead(documents[i], res.locals.uid));
        }

        return returnDocuments;
    }

    const result : {members: any[], groups: any[], customFronts: any[], fronters: any[], channels: any[] }= {
        members: [],
        groups: [],
        customFronts: [],
        fronters: [],
        channels: []
    }

    result.members = constructDocumentsForClientRead(members);
    result.groups = constructDocumentsForClientRead(groups);
    result.customFronts = constructDocumentsForClientRead(customFronts);
    result.fronters = constructDocumentsForClientRead(fronters);
    result.channels = constructDocumentsForClientRead(channels);

    res.status(200).send(result)
}