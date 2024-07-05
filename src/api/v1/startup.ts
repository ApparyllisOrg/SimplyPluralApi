import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { transformResultForClientRead } from "../../util";
import internal, { Stream, Transform } from "stream";

export const getStartupData = async (req: Request, res: Response) => {

    res.setHeader("content-type", "application/json; charset=utf-8")

    const streamQuery = async (query: internal.Readable & AsyncIterable<any>) : Promise<void> =>
    {
        return new Promise<void>(async (resolve, reject) => 
        {
            let processedFirstResult = false

            const responseStream = new Stream.Writable({
                write: function(chunk, encoding, next) {
                    res.write(chunk)
                    next();
                }
              })
           
            const transformPipe = new Transform({
                objectMode: true,
                transform: (chunk, encoding, next) => {
                    if (processedFirstResult)
                    {
                        next(null, `,${JSON.stringify(transformResultForClientRead(chunk, res.locals.uid))}`)
                    }
                    else 
                    {
                        next(null, JSON.stringify(transformResultForClientRead(chunk, res.locals.uid)))
                        processedFirstResult = true
                    }
                },
            });
    
            transformPipe.on("end", () => 
            {
                resolve();
            })
    
            query.pipe(transformPipe).pipe(responseStream)
        })
    }

	res.write('{ "members": [')

    const membersStream = getCollection("members").find({ uid: res.locals.uid }).stream()
    await streamQuery(membersStream)
   
    res.write('], "groups": [')

    const groupsStream = getCollection("groups").find({ uid: res.locals.uid }).stream()
    await streamQuery(groupsStream)

    res.write('], "customFronts": [')

    const customFrontsStream = getCollection("frontStatuses").find({ uid: res.locals.uid }).stream()
    await streamQuery(customFrontsStream)

    res.write('], "fronters": [')

    const frontersStream = getCollection("frontHistory").find({ uid: res.locals.uid, live: true }).stream()
    await streamQuery(frontersStream)

    res.write('], "channels": [')

    const channelsStream = getCollection("channels").find({ uid: res.locals.uid }).stream()
    await streamQuery(channelsStream)

    res.write(']}')
    res.end();
}