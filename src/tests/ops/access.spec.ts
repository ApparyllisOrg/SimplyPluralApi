import assert from "assert";
import * as mocha from "mocha";
import { containsWhere, getIdWhere, getTestAxiosUrl, postDocument } from "../utils";
import { ObjectId } from "mongodb";
import { expect } from "chai";
import axios from "axios";
import moment from "moment";
import { notifyFrontDue } from "../../modules/events/frontChange";
import { AccountState, registerAccount } from "./access/utils";

describe("validate access across accounts", () => {

    let acc1 : AccountState = {id: "", token: ""}; // Account sharing data

	let acc2 : AccountState = {id: "", token: ""}; // Account marked as friend to acc1
    let acc3 : AccountState = {id: "", token: ""}; // Account marked as trusted friend to acc1
    let acc4 : AccountState = {id: "", token: ""}; // Account marked as friend to acc1 but cannot see front
    let acc5 : AccountState = {id: "", token: ""}; // Account marked as trusted friend to acc1 but cannot see front
    let acc6 : AccountState = {id: "", token: ""}; // Account given no access
    let acc7 : AccountState = {id: "", token: ""}; // Account not a friend

    return

	mocha.test("Setup test accounts", async () => {

        // Register sharing account
        acc1 = await registerAccount(0, acc1)

        // Register new accounts
        acc2 = await registerAccount(1, acc2)
        acc3 = await registerAccount(2, acc3)
        acc4 = await registerAccount(3, acc4)
        acc5 = await registerAccount(4, acc5)
        acc6 = await registerAccount(5, acc6)
        acc7 = await registerAccount(6, acc7)

	});

    let acc1BucketFriends : ObjectId | undefined;
    let acc1BucketTrustedFriends : ObjectId | undefined;

    mocha.test("Befriend test accounts", async () => {

        // Send friend requests
        {
            const result = await axios.post(getTestAxiosUrl(`v2/friends/request/add/${acc2.id}`), { settings: { seeMembers: true, seeFront: true, getFrontNotif: false}}, { headers: { authorization: acc1.token }, validateStatus: () => true })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v2/friends/request/add/${acc3.id}`), { settings: { seeMembers: true, seeFront: true, getFrontNotif: false}}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v2/friends/request/add/${acc4.id}`), { settings: { seeMembers: true, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v2/friends/request/add/${acc5.id}`), { settings: { seeMembers: true, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v2/friends/request/add/${acc6.id}`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        // Accept friend requests
        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc2.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc3.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc4.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc5.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false}}, { headers: { authorization: acc6.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }
     })

    mocha.test("Grant friends access", async () => {

        const buckets : any = (await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1.token } })).data;

        acc1BucketFriends = getIdWhere(buckets, (doc) => doc.name === "Friends")
        acc1BucketTrustedFriends = getIdWhere(buckets, (doc) => doc.name === "Trusted friends")

        {
            const result = await axios.patch(getTestAxiosUrl('v1/privacyBucket/assignfriends'), {bucket: acc1BucketFriends, friends: [acc2.id, acc3.id, acc4.id, acc5.id]}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200)
        }

        {
            const result = await axios.patch(getTestAxiosUrl('v1/privacyBucket/assignfriends'), {bucket: acc1BucketTrustedFriends, friends: [acc3.id, acc5.id]}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200)
        }

     });

    const setupTypeAccess = async (type: string, url: string, insertObj : any) : Promise<void> => 
    {
        const bucketResult = await axios.get(getTestAxiosUrl("v1/privacyBuckets"), { headers: { authorization: acc1.token }, validateStatus: () => true })
         expect(bucketResult.status).to.eq(200)

        acc1BucketFriends = getIdWhere(bucketResult.data, (doc) => doc.name === "Friends")
        acc1BucketTrustedFriends = getIdWhere(bucketResult.data, (doc) => doc.name === "Trusted friends")

        expect(acc1BucketFriends, 'Find friends bucket')
        expect(acc1BucketFriends, 'Find trusted friends bucket')

        let acc1PrivateType : ObjectId | string | null;
        let acc1TrustedFriendType : ObjectId | string | null;
        let acc1FriendType : ObjectId | string | null;

        const getPostData = (obj: any, staticData: {name: string}) =>
        {

            return Object.assign(obj, staticData)
        } 

        acc1PrivateType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, {name: "Private"}))).id
        acc1TrustedFriendType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, {name: "Trusted Friend"}))).id
        acc1FriendType = (await postDocument(url, acc1.id, acc1.token, getPostData(insertObj, {name: "Friend"}))).id

        expect(acc1PrivateType, `Create Private ${type}`)
        expect(acc1TrustedFriendType, `Create "Trusted Friend ${type}`)
        expect(acc1FriendType, `Create Friend ${type}`)

        {
            const result = await axios.patch(getTestAxiosUrl('v1/privacyBucket/setbuckets'), {id: acc1FriendType, buckets:[acc1BucketFriends], type}, { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200)
        }

        {
            const result = await axios.patch(getTestAxiosUrl('v1/privacyBucket/setbuckets'), {id: acc1TrustedFriendType, buckets:[acc1BucketTrustedFriends], type},  { headers: { authorization: acc1.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200)
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

     const testTypeAccess = async (url: string, singleUrl: string, token: string, expectedNames : string[]) : Promise<void> => 
     {
         const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token }, validateStatus: () => true });

         expect(contentResult.status).to.eq(200, contentResult.data)

         if (Array.isArray(contentResult.data))
         {
            expect(contentResult.data.length).to.eq(expectedNames.length, `${url} -> Test type access received an array but array length is mismatched`)

            for (let i = 0; i < expectedNames.length; ++i)
            {
                const name = expectedNames[i]
                const foundName = containsWhere(contentResult.data, (doc) => doc.name === name)
                expect(foundName).to.eq(true, `${url} -> Test type access received but values mismatch. Tried to find ${name}`)
                if (foundName)
                {
                    const typeId = getIdWhere(contentResult.data, (doc) => doc.name === name)

                    const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${typeId}`), { headers: { authorization: token }, validateStatus: () => true });

                    expect(singleContentResult.status).to.eq(200, singleContentResult.data)
                    expect(singleContentResult.data.content.name).to.eq(name, 'Tried to get single content but name mismatched')
                }
            }
         }
         else 
         {
            assert(false, "Test type access received a non-array") 
         }
     }

     const testNoTypeAccess = async ( url: string, singleUrl: string, token: string,) : Promise<void> => 
     {
         const contentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: token, }, validateStatus: () => true });

         expect(contentResult.status).to.eq(403, contentResult.data)

         if (Array.isArray(contentResult.data))
         {
            expect(contentResult.data.length).to.eq(0, `${url} -> Expected an empty array but received data`)
         }

         {
            // acc3 has full access, get the member ids from acc1 and tried to fetch with current test account
            const passingContentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: acc3.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id

                    const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${typeId}`), { headers: { authorization: token }, validateStatus: () => true });

                    expect(singleContentResult.status).to.eq(403, singleContentResult.data)
                }
            }
            else 
            {
                assert(false, "Test no type access received a non-array") 
            }
         }

     }

     mocha.test("Test members access", async () => {
    
        await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc2.token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc3.token, ['Friend', 'Trusted Friend'])
        await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc4.token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc5.token, ['Friend', 'Trusted Friend'])
        await testNoTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc6.token,)
        await testNoTypeAccess(`v1/members/${acc1.id}`, `v1/member/${acc1.id}`, acc7.token,)

     });
 
     mocha.test("Test groups access", async () => {

         await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc2.token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc3.token, ['Friend', 'Trusted Friend'])
         await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc4.token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc5.token, ['Friend', 'Trusted Friend'])
         await testNoTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc6.token,)
         await testNoTypeAccess(`v1/groups/${acc1.id}`, `v1/group/${acc1.id}`, acc7.token,)

      });
 
      mocha.test("Test custom fronts access", async () => {
   
         await testTypeAccess( `v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc2.token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc3.token, ['Friend', 'Trusted Friend'])
         await testTypeAccess( `v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc4.token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc5.token, ['Friend', 'Trusted Friend'])
         await testNoTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc6.token,)
         await testNoTypeAccess(`v1/customFronts/${acc1.id}`, `v1/customFront/${acc1.id}`, acc7.token,)
  
      });
 
      mocha.test("Test custom fields access", async () => {
   
        await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc2.token, ['Friend'])
        await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc3.token, ['Friend', 'Trusted Friend'])
        await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc4.token, ['Friend'])
        await testTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc5.token, ['Friend', 'Trusted Friend'])
        await testNoTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc6.token,)
        await testNoTypeAccess(`v1/customFields/${acc1.id}`, `v1/customField/${acc1.id}`, acc7.token,)
  
      });

      mocha.test("Setup members and custom fronts front status", async () => {
	
        {
            const passingContentResult = await axios.get(getTestAxiosUrl(`v1/members/${acc1.id}`), { headers: { authorization: acc1.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
               expect(passingContentResult.data.length).to.eq(3, 'Number of members when trying to setup front status is incorrect')
   
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id
                    const postfrontEntry = await axios.post(getTestAxiosUrl(`v1/frontHistory`), {custom: false, live: true, startTime: moment.now(), member: typeId}, { headers: { authorization: acc1.token }, validateStatus: () => true });
                    expect(postfrontEntry.status).to.eq(200, postfrontEntry.data)
               }
           }
        }

        {
            const passingContentResult = await axios.get(getTestAxiosUrl(`v1/customFronts/${acc1.id}`), { headers: { authorization: acc1.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
               expect(passingContentResult.data.length).to.eq(3, 'Number of custom fronts when trying to setup front status is incorrect')
   
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id
                    const postfrontEntry = await axios.post(getTestAxiosUrl(`v1/frontHistory`), {custom: true, live: true, startTime: moment.now(), member: typeId}, { headers: { authorization: acc1.token }, validateStatus: () => true });
                    expect(postfrontEntry.status).to.eq(200, postfrontEntry.data)
               }
           }
        }
 
     });

      const testFrontAccess = async (uid: string, token: string, expectedFrontingNum : number, expectFrontString: string, expectCustomFrontString: string) : Promise<void> => 
      {
        {
            const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFront`), { headers: { authorization: token }, validateStatus: () => true });
 
            expect(frontResult.status).to.eq(200, frontResult.data)
   
            const fronters = frontResult.data.fronters
            if (Array.isArray(fronters))
            {
               expect(fronters.length).to.eq(expectedFrontingNum, `${uid} -> Fronters fronters access received an array but array length is mismatched`)
            }
            else 
            {
               assert(false, "Test type access received a non-array") 
            }
        }
          
        {
            const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFrontValue`), { headers: { authorization: token }, validateStatus: () => true });
 
            expect(frontResult.status).to.eq(200, frontResult.data)
            expect(frontResult.data.frontString).to.eq(expectFrontString, 'Expected front string is wrong')
            expect(frontResult.data.customFrontString).to.eq(expectCustomFrontString, 'Expected custom front string is wrong')
        }
      }

      const testNoFrontAccess = async (uid: string, token: string) : Promise<void> => 
      {
        {
            const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFront`), { headers: { authorization: token }, validateStatus: () => true });
            expect(frontResult.status).to.eq(403, frontResult.data)
  
        }
        
        {
            const frontResult = await axios.get(getTestAxiosUrl(`v1/friend/${uid}/getFrontValue`), { headers: { authorization: token }, validateStatus: () => true });
            expect(frontResult.status).to.eq(403, frontResult.data)
        }
      }

      mocha.test("Test front access", async () => {

        // Trigger front due to set the front string
        await notifyFrontDue(acc1.id, '')

        // Expect member and custom front fronting
        await testFrontAccess(acc1.id, acc2.token, 2, "Friend", "Friend")

        // Expect member and custom front fronting, both friend and trusted friend members
        await testFrontAccess(acc1.id, acc3.token, 4, "Friend, Trusted Friend", "Friend, Trusted Friend")

        // Expect no access to fronters
        await testNoFrontAccess(acc1.id, acc4.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1.id, acc5.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1.id, acc6.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1.id, acc7.token)
  
      });
});
