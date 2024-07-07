import assert from "assert";
import axios from "axios";
import * as mocha from "mocha";
import { getCollection } from "../../modules/mongo";
import { getIdWhere, getTestAxiosUrl, postDocument } from "../utils";
import { JwtPayload, decode } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { expect } from "chai";

describe("validate access across accounts", () => {

    const acc1 = "test-access-1@apparyllis.com"; // Account sharing data
	const acc2 = "test-access-2@apparyllis.com"; // Account marked as friend to acc1
    const acc3 = "test-access-3@apparyllis.com"; // Account marked as trusted friend to acc1
    const acc4 = "test-access-4@apparyllis.com"; // Account marked as friend to acc1 but cannot see front
    const acc5 = "test-access-5@apparyllis.com"; // Account marked as trusted friend to acc1 but cannot see front
    const acc6 = "test-access-6@apparyllis.com"; // Account given no access
    const acc7 = "test-access-7@apparyllis.com"; // Account not a friend
	const password = "APasswordTh3tFitsTh3Regexp!";

	let acc1Id = "";
    let acc2Id = "";
    let acc3Id = "";
    let acc4Id = "";
    let acc5Id = "";
    let acc6Id = "";
    let acc7Id = "";

	let acc1Token = "";
	let acc2Token = "";
	let acc3Token = "";
    let acc4Token = "";
    let acc5Token = "";
    let acc6Token = "";
    let acc7Token = "";

	mocha.test("Setup test accounts", async () => {
        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc1, password });
            assert(result.data);
    
            acc1Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc1Id = jwtPayload!.sub!;
    
            const firstAcc = await getCollection("accounts").findOne({ email: acc1 });
            assert(firstAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc2, password });
            assert(result.data);
    
            acc2Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc2Id = jwtPayload!.sub!;
    
            const secondAcc = await getCollection("accounts").findOne({ email: acc2 });
            assert(secondAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc3, password });
            assert(result.data);
    
            acc3Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc3Id = jwtPayload!.sub!;
    
            const thirdAcc = await getCollection("accounts").findOne({ email: acc3 });
            assert(thirdAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc4, password });
            assert(result.data);
    
            acc4Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc4Id = jwtPayload!.sub!;
    
            const thirdAcc = await getCollection("accounts").findOne({ email: acc4 });
            assert(thirdAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc5, password });
            assert(result.data);
    
            acc5Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc5Id = jwtPayload!.sub!;
    
            const thirdAcc = await getCollection("accounts").findOne({ email: acc5 });
            assert(thirdAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc6, password });
            assert(result.data);
    
            acc6Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc6Id = jwtPayload!.sub!;
    
            const thirdAcc = await getCollection("accounts").findOne({ email: acc6 });
            assert(thirdAcc);
        }

        {
            const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email: acc7, password });
            assert(result.data);
    
            acc7Token = result.data.access;
            const jwtPayload = decode(result.data.access, { json: true });
    
            acc7Id = jwtPayload!.sub!;
    
            const thirdAcc = await getCollection("accounts").findOne({ email: acc7 });
            assert(thirdAcc);
        }
	});

    let acc1BucketFriends : ObjectId | undefined;
    let acc1BucketTrustedFriends : ObjectId | undefined;

    mocha.test("Grant friends access", async () => {

        const buckets : any = (await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1Token } })).data;

        acc1BucketFriends = getIdWhere(buckets, (doc) => doc.name === "Friends")
        acc1BucketTrustedFriends = getIdWhere(buckets, (doc) => doc.name === "Trusted friends")

        {
            const result = await axios.post(getTestAxiosUrl('v1/privacyBucket/assignbuckets'), {bucket: acc1BucketFriends, friends: [acc2Id, acc3Id, acc4Id, acc5Id]}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl('v1/privacyBucket/assignbuckets'), {bucket: acc1BucketTrustedFriends, friends: [acc3Id, acc5Id]}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friend/${acc2Id}`), {seeMembers: true, seeFront: true}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friend/${acc3Id}`), {seeMembers: true, seeFront: true}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friend/${acc4Id}`), {seeMembers: true, seeFront: false}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friend/${acc5Id}`), {seeMembers: true, seeFront: false}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friend/${acc6Id}`), {seeMembers: false, seeFront: false}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }
     });

    const setupTypeAccess = async (type: string, url: string, insertObj : any) : Promise<void> => 
    {
        const buckets : any = (await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1Token } })).data;

        acc1BucketFriends = getIdWhere(buckets, (doc) => doc.name === "Friends")
        acc1BucketTrustedFriends = getIdWhere(buckets, (doc) => doc.name === "Trusted friends")

        expect(acc1BucketFriends, 'Find friends bucket')
        expect(acc1BucketFriends, 'Find trusted friends bucket')

        let acc1PrivateType : ObjectId | string | null;
        let acc1TrustedFriendType : ObjectId | string | null;
        let acc1FriendType : ObjectId | string | null;

        const getPostData = (obj: any, staticData: {name: string}) =>
        {
            return Object.assign(obj, staticData)
        } 

        acc1PrivateType = (await postDocument(url, acc1Id, acc1Token, getPostData(insertObj, {name: "Private"}))).id
        acc1TrustedFriendType = (await postDocument(url, acc1Id, acc1Token, getPostData(insertObj, {name: "Trusted Friend"}))).id
        acc1FriendType = (await postDocument(url, acc1Id, acc1Token, getPostData(insertObj, {name: "Friend"}))).id

        expect(acc1PrivateType, `Create Private ${type}`)
        expect(acc1TrustedFriendType, `Create "Trusted Friend ${type}`)
        expect(acc1FriendType, `Create Friend ${type}`)

        {
            const result = await axios.post(getTestAxiosUrl('v1/privacyBuckett/setbuckets'), {id: acc1FriendType, buckets:[acc1BucketFriends], type}, { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }

        {
            const result = await axios.post(getTestAxiosUrl('v1/privacyBuckett/setbuckets'), {id: acc1TrustedFriendType, buckets:[acc1BucketTrustedFriends], type},  { headers: { authorization: acc1Token } })
            assert(result.status === 200)
        }
    }

	mocha.test("Setup members access", async () => {
	
       await setupTypeAccess("members", "v1/member", {})

	});

    mocha.test("Setup groups access", async () => {
	
        await setupTypeAccess("groups", "v1/group", {desc: "", color: "", parent: "", emoji: "", members: []})
 
     });

     mocha.test("Setup custom fronts access", async () => {
	
        await setupTypeAccess("frontStatuses", "v1/customFront", {})
 
     });

     mocha.test("Setup custom fields access", async () => {

       await setupTypeAccess("customFields", "v1/customField", {supportMarkdown: false, type: 0, order: "0|aaaaaa:"})
 
     });

     const testTypeAccess = async (url: string, token: string, expectedNames : string[]) : Promise<void> => 
     {
         const contentResult : any = (await axios.get(getTestAxiosUrl(url), { headers: { authorization: token } })).data;

         if (Array.isArray(contentResult))
         {
            assert(contentResult.length === expectedNames.length, "Test type access received an array but array length is mismatched")
            expectedNames.forEach((name) => 
            {
               assert(getIdWhere(contentResult, (doc) => doc.name === name))
            })
         }
         else 
         {
            assert(false, "Test type access received a non-array") 
         }
     }

     const testNoTypeAccess = async ( url: string, token: string,) : Promise<void> => 
     {
         const contentResult : any = (await axios.get(getTestAxiosUrl(url), { headers: { authorization: token } })).data;
         if (Array.isArray(contentResult))
         {
             assert(contentResult.length === 0, "Expected an empty array but received data") 
             return undefined
         }
     }

     mocha.test("Test members access", async () => {
	
        await testTypeAccess(`v1/members/${acc1Id}`, acc2Token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1Id}`, acc3Token, ['Friends', 'Trusted Friend'])
        await testTypeAccess(`v1/members/${acc1Id}`, acc4Token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1Id}`, acc5Token, ['Friends', 'Trusted Friend'])
        await testNoTypeAccess(`v1/members/${acc1Id}`, acc5Token,)

 
     });
 
     mocha.test("Test groups access", async () => {
     
         await testTypeAccess(`v1/groups/${acc1Id}`, acc2Token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1Id}`, acc3Token, ['Friends', 'Trusted Friend'])
         await testTypeAccess(`v1/groups/${acc1Id}`, acc4Token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1Id}`, acc5Token, ['Friends', 'Trusted Friend'])
         await testNoTypeAccess(`v1/groups/${acc1Id}`, acc5Token,)

      });
 
      mocha.test("Test custom fronts access", async () => {
     
         await testTypeAccess( `v1/customFronts/${acc1Id}`, acc2Token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1Id}`, acc3Token, ['Friends', 'Trusted Friend'])
         await testTypeAccess( `v1/customFronts/${acc1Id}`, acc4Token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1Id}`, acc5Token, ['Friends', 'Trusted Friend'])
         await testNoTypeAccess(`v1/customFronts/${acc1Id}`, acc6Token,)
  
      });
 
      mocha.test("Test custom fields access", async () => {
 
        await testTypeAccess(`v1/customFields/${acc1Id}`, acc2Token, ['Friend'])
        await testTypeAccess(`v1/customFields/${acc1Id}`, acc3Token, ['Friends', 'Trusted Friend'])
        await testTypeAccess(`v1/customFields/${acc1Id}`, acc4Token, ['Friend'])
        await testTypeAccess(`v1/customFields/${acc1Id}`, acc5Token, ['Friends', 'Trusted Friend'])
        await testNoTypeAccess(`v1/customFields/${acc1Id}`, acc6Token,)
  
      });
});
