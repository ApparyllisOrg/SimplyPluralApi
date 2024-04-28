import { Diff, diff } from "deep-diff"
import { ObjectId } from "mongodb"
import { getCollection } from "../modules/mongo"
import { limitStringLength } from "./string"

const auditCollections = ['members', 'groups', 'customFields', 'frontStatuses', 'channels', 'channelCategories']

export type DiffResult = { p: string, o: string, n: string, cn: boolean }
export type DiffReturn = Promise<
{processed: false, result: undefined} 
| {processed: true, result: DiffResult }
| {processed: true, result: DiffResult[] }
| {processed: true, result: undefined, ignore: true } >
export type DiffProcessor = (uid: string, difference: Diff<any, any>, lhs: any, rhs: any) => DiffReturn

export const logAudit = async (uid: string, _id: string | ObjectId, collection: string, t: number, lhs: any, rhs: any, processor: (DiffProcessor | undefined)) =>
{
    if (auditCollections.indexOf(collection) === -1)
    {
        return;
    }

    const name = lhs.name ?? rhs.name
    if (typeof name !== "string" || name.length === 0) // Don't log audits of nameless things, that just confuses people
    {
       return
    }

    const difference = diff(lhs, rhs)
    if (difference)
    {
        // path, old, new
        const changes : DiffResult[] = []

        for (let i = 0; i < difference.length; ++i)
        {
            const diff = difference[i]

            if (!diff.path || diff.path?.length == 0)
            {
                continue;
            }

            // Ignore internal values
            if (diff.path[0] === "lastOperationTime" || diff.path[0] === "uid" || diff.path[0] === "_id")
            {
                continue;
            }

            // Ignore legacy properties
            if (diff.path[0] === "private" || diff.path[0] === "preventTrusted")
            {
                continue;
            }

            if (processor !== undefined)
            {
                const processorResult = await processor(uid, diff, lhs, rhs)
                if (processorResult.processed === true)
                {
                    if (processorResult.result === undefined && processorResult.ignore === true)
                    {
                        continue
                    }

                    if (processorResult.result !== undefined)
                    {
                        if (Array.isArray(processorResult.result))
                        {
                            processorResult.result.forEach((entry) =>  changes.push(entry))
                        }
                        else 
                        {
                            changes.push(processorResult.result)
                        }
                    }
                  
                    continue
                }
            }

            const newValue = rhs[diff.path![0]]	

            const getValue = (value: any) =>
            {
                if (typeof value === "string")
                {
                    if (value.length > 50)
                    {
                        return limitStringLength(value, 50, true)
                    }

                    return value
                }

                return value.toString();
            }

            if (diff.kind === "A")
            {
                changes.push({p: diff.path[diff.path.length - 1], o: "", n: getValue(newValue), cn: false})
                diff.path
            }

            if (diff.kind === "E")
            {
                const oldValue = lhs[diff.path![0]]

                changes.push({p: diff.path[diff.path.length - 1], o: getValue(oldValue), n: getValue(newValue), cn: false})
                diff.path
            }
        }

        if (changes.length > 0)
        {
           getCollection("audit").insertOne({uid, t, changes, name, coll: collection, id: _id, a: "u"})
        }
    }
}

export const logCreatedAudit = (uid: string, _id: string | ObjectId, collection: string, t: number, newDocument: any) =>
{
    if (auditCollections.indexOf(collection) === -1)
    {
        return;
    }

    if (newDocument && newDocument.name)
    {
        const name = newDocument.name
        if (typeof name === "string" && name.length > 0) // Don't log audits of nameless things, that just confuses people
        {
            getCollection("audit").insertOne({uid, t, changes: [], name: newDocument.name, coll: collection, id: _id, a: "a" })
        }
    }
   
}

export const logDeleteAudit = (uid: string, collection: string, t: number, originalDocument: any) =>
{
    if (auditCollections.indexOf(collection) === -1)
    {
        return;
    }

    if (originalDocument && originalDocument.name)
    {
        const name = originalDocument.name
        if (typeof name === "string" && name.length > 0) // Don't log audits of nameless things, that just confuses people
        {
            getCollection("audit").insertOne({uid, t, changes: [], name: originalDocument.name, coll: collection, id: '', a: "d" })
        }
    }
   
}