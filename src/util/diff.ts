import { Diff, diff } from "deep-diff"
import { ObjectId } from "mongodb"
import { getCollection } from "../modules/mongo"
import { limitStringLength } from "./string"
import { FIELD_MIGRATION_VERSION, doesUserHaveVersion } from "../api/v1/user/updates/updateUser"
import moment from "moment"

const auditCollections = ['members', 'groups', 'customFields', 'frontStatuses']

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
        return
    }

    const hasVersion = await doesUserHaveVersion(uid, FIELD_MIGRATION_VERSION);
    if (!hasVersion)
    {
        return
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

        const privateDoc = await getCollection("private").findOne({uid, _id: uid})
        if (!privateDoc)
        {
            return
        }

    
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

        // We record/diff changes to figure out if we actually changed something, an update call that changes nothing shouldn't be logged
        if (changes.length > 0)
        {
            const retentionDays =  privateDoc.auditRetention ?? 31
            const expiry = moment.now() + (retentionDays * 1000 * 60 * 60 * 24)

            if (privateDoc.auditContentChanges === true)
            {
                getCollection("audit").insertOne({uid, t, changes, name, coll: collection, id: _id, a: "u", exp: expiry})
            }
            else 
            {
                getCollection("audit").insertOne({uid, t, changes: [], name, coll: collection, id: _id, a: "u", exp: expiry})
            }
        }
    }
}

export const logCreatedAudit = async (uid: string, _id: string | ObjectId, collection: string, t: number, newDocument: any) =>
{
    if (auditCollections.indexOf(collection) === -1)
    {
        return;
    }

    const hasVersion = await doesUserHaveVersion(uid, FIELD_MIGRATION_VERSION);
    if (!hasVersion)
    {
        return
    }

    if (newDocument && newDocument.name)
    {
        const name = newDocument.name
        if (typeof name === "string" && name.length > 0) // Don't log audits of nameless things, that just confuses people
        {
            const privateDoc = await getCollection("private").findOne({uid, _id: uid})
            if (privateDoc)
            {
                const retentionDays =  privateDoc.auditRetention ?? 31
                const expiry = moment.now() + (retentionDays * 1000 * 60 * 60 * 24)
                getCollection("audit").insertOne({uid, t, changes: [], name: newDocument.name, coll: collection, id: _id, a: "a", exp: expiry })
            }
        }
    }
   
}

export const logDeleteAudit = async (uid: string, collection: string, t: number, originalDocument: any) =>
{
    if (auditCollections.indexOf(collection) === -1)
    {
        return;
    }

    const hasVersion = await doesUserHaveVersion(uid, FIELD_MIGRATION_VERSION);
    if (!hasVersion)
    {
        return
    }

    if (originalDocument && originalDocument.name)
    {
        const name = originalDocument.name
        if (typeof name === "string" && name.length > 0) // Don't log audits of nameless things, that just confuses people
        {
            const privateDoc = await getCollection("private").findOne({uid, _id: uid})
            if (privateDoc)
            {
                const retentionDays =  privateDoc.auditRetention ?? 31
                const expiry = moment.now() + (retentionDays * 1000 * 60 * 60 * 24)
                getCollection("audit").insertOne({uid, t, changes: [], name: originalDocument.name, coll: collection, id: '', a: "d", exp: expiry })
            }
        }
    }
   
}