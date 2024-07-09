import assert from "assert";
import * as mocha from "mocha";
import { getCollection } from "../../modules/mongo";
import { containsWhere, getIdWhere, getTestAxiosUrl, postDocument, sleep } from "../utils";
import { decode } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { expect } from "chai";
import axios from "axios";
import moment from "moment";
import { frontChange, notifyFrontDue } from "../../modules/events/frontChange";
import { FIELD_MIGRATION_VERSION } from "../../api/v1/user/updates/updateUser";
import { AccountState, registerAccount } from "./access/utils";

describe("validate access across accounts", () => {

    let acc1_legacy : AccountState = {id: "", token: ""}; // Legacy Account sharing data
    let acc2_legacy : AccountState = {id: "", token: ""}; // Legacy Account marked as friend to acc1_legacy
    let acc3_legacy : AccountState = {id: "", token: ""}; // Legacy Account marked as trusted friend to acc1_legacy
    let acc4_legacy : AccountState = {id: "", token: ""}; // Legacy Account marked as friend to acc1_legacy but cannot see front
    let acc5_legacy : AccountState = {id: "", token: ""}; // Legacy Account marked as trusted friend to acc1_legacy but cannot see front
    let acc6_legacy : AccountState = {id: "", token: ""}; // Legacy Account given no access
    let acc7_legacy : AccountState = {id: "", token: ""}; // Legacy Account not a friend

	mocha.test("Setup legacy test accounts", async () => {

        // Register sharing account
        acc1_legacy = await registerAccount(13, acc1_legacy)

        // Register legacy accounts
        acc2_legacy = await registerAccount(7, acc2_legacy)
        acc3_legacy = await registerAccount(8, acc3_legacy)
        acc4_legacy = await registerAccount(9, acc4_legacy)
        acc5_legacy = await registerAccount(10, acc5_legacy)
        acc6_legacy = await registerAccount(11, acc6_legacy)
        acc7_legacy = await registerAccount(12, acc7_legacy)

        await getCollection('private').updateMany({uid: {$in: [
            acc1_legacy.id,
            acc2_legacy.id, 
            acc3_legacy.id, 
            acc4_legacy.id, 
            acc5_legacy.id, 
            acc6_legacy.id, 
            acc7_legacy.id, 
        ]}}, {$set: {latestVersion: FIELD_MIGRATION_VERSION - 1}})

	});

     mocha.test("Befriend legacy test accounts", async () => {

        // Send friend requests
        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/add/${acc2_legacy.id}`), { settings: { seeMembers: true, seeFront: true, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/add/${acc3_legacy.id}`), { settings: { seeMembers: true, seeFront: true, getFrontNotif: false, trusted: true}}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/add/${acc4_legacy.id}`), { settings: { seeMembers: true, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/add/${acc5_legacy.id}`), { settings: { seeMembers: true, seeFront: false, getFrontNotif: false, trusted: true}}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/add/${acc6_legacy.id}`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        // Accept friend requests
        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc2_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc3_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc4_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc5_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        {
            const result = await axios.post(getTestAxiosUrl(`v1/friends/request/respond/${acc1_legacy.id}?accepted=true`), { settings: { seeMembers: false, seeFront: false, getFrontNotif: false, trusted: false}}, { headers: { authorization: acc6_legacy.token }, validateStatus: () => true  })
            expect(result.status).to.eq(200, result.data)
        }

        // Sleep for Friends LRU Cache to be invalidated
        await sleep(10000)
     })


    mocha.test("Grant legacy friends access", async () => {



     });

    const setupTypeAccess = async (type: string, url: string, insertObj : any) : Promise<void> => 
    {
        let acc1PrivateType : ObjectId | string | null;
        let acc1TrustedFriendType : ObjectId | string | null;
        let acc1FriendType : ObjectId | string | null;

        const getPostData = (obj: any, staticData: {name: string, private?: boolean | undefined, preventTrusted?: boolean | undefined}) =>
        {
            return Object.assign(obj, staticData)
        } 

        acc1PrivateType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, {name: "Private", private: true, preventTrusted: true}))).id
        acc1TrustedFriendType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, {name: "Trusted Friend", private: true, preventTrusted: false}))).id
        acc1FriendType = (await postDocument(url, acc1_legacy.id, acc1_legacy.token, getPostData(insertObj, {name: "Friend", private: false, preventTrusted: false}))).id

        expect(acc1PrivateType, `Create Private ${type}`)
        expect(acc1TrustedFriendType, `Create "Trusted Friend ${type}`)
        expect(acc1FriendType, `Create Friend ${type}`)
    }

	mocha.test("Setup legacy members access", async () => {
	
       await setupTypeAccess("members", "v1/member", {})

	});

    mocha.test("Setup legacy groups access", async () => {

        await setupTypeAccess("groups", "v1/group", {desc: "", color: "", parent: "", emoji: "", members: []})
 
     });

     mocha.test("Setup legacy custom fronts access", async () => {

        await setupTypeAccess("frontStatuses", "v1/customFront", {})
 
     });

     mocha.test("Setup legacy custom fields access", async () => {

    
 
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
            // acc3_legacy has full access, get the member ids from acc1_legacy and tried to fetch with current test account
            const passingContentResult = await axios.get(getTestAxiosUrl(url), { headers: { authorization: acc3_legacy.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id

                    const singleContentResult = await axios.get(getTestAxiosUrl(`${singleUrl}/${typeId}`), { headers: { authorization: token }, validateStatus: () => true });

                    expect(singleContentResult.status).to.eq(403, JSON.stringify(singleContentResult.data))
                }
            }
            else 
            {
                assert(false, "Test no type access received a non-array") 
            }
         }

     }

     mocha.test("Test legacy members access", async () => {
    
        await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc2_legacy.token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc3_legacy.token, ['Friend', 'Trusted Friend'])
        await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc4_legacy.token, ['Friend'])
        await testTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc5_legacy.token, ['Friend', 'Trusted Friend'])
        await testNoTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc6_legacy.token,)
        await testNoTypeAccess(`v1/members/${acc1_legacy.id}`, `v1/member/${acc1_legacy.id}`, acc7_legacy.token,)

     });
 
     mocha.test("Test legacy groups access", async () => {

         await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc2_legacy.token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc3_legacy.token, ['Friend', 'Trusted Friend'])
         await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc4_legacy.token, ['Friend'])
         await testTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc5_legacy.token, ['Friend', 'Trusted Friend'])
         await testNoTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc6_legacy.token,)
         await testNoTypeAccess(`v1/groups/${acc1_legacy.id}`, `v1/group/${acc1_legacy.id}`, acc7_legacy.token,)

      });
 
      mocha.test("Test legacy custom fronts access", async () => {

         await testTypeAccess( `v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc2_legacy.token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc3_legacy.token, ['Friend', 'Trusted Friend'])
         await testTypeAccess( `v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc4_legacy.token, ['Friend'])
         await testTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc5_legacy.token, ['Friend', 'Trusted Friend'])
         await testNoTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc6_legacy.token,)
         await testNoTypeAccess(`v1/customFronts/${acc1_legacy.id}`, `v1/customFront/${acc1_legacy.id}`, acc7_legacy.token,)
  
      });
 
      mocha.test("Test legacy custom fields access", async () => {
   
  
      });

      mocha.test("Setup legacy members and custom fronts front status", async () => {
  
        {
            const passingContentResult = await axios.get(getTestAxiosUrl(`v1/members/${acc1_legacy.id}`), { headers: { authorization: acc1_legacy.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
               expect(passingContentResult.data.length).to.eq(3, 'Number of members when trying to setup front status is incorrect')
   
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id
                    const postfrontEntry = await axios.post(getTestAxiosUrl(`v1/frontHistory`), {custom: false, live: true, startTime: moment.now(), member: typeId}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true });
                    expect(postfrontEntry.status).to.eq(200, postfrontEntry.data)
               }
           }
        }

        {
            const passingContentResult = await axios.get(getTestAxiosUrl(`v1/customFronts/${acc1_legacy.id}`), { headers: { authorization: acc1_legacy.token }, validateStatus: () => true });

            expect(passingContentResult.status).to.eq(200, passingContentResult.data)
   
            if (Array.isArray(passingContentResult.data))
            {
               expect(passingContentResult.data.length).to.eq(3, 'Number of custom fronts when trying to setup front status is incorrect')
   
                for (let i = 0; i < passingContentResult.data.length; ++i)
                {
                    const typeId = passingContentResult.data[i].id
                    const postfrontEntry = await axios.post(getTestAxiosUrl(`v1/frontHistory`), {custom: true, live: true, startTime: moment.now(), member: typeId}, { headers: { authorization: acc1_legacy.token }, validateStatus: () => true });
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

      mocha.test("Test legacyfront access", async () => {
       
        // Expect member and custom front fronting
        await testFrontAccess(acc1_legacy.id, acc2_legacy.token, 2, "Friend", "Friend")

        // Expect member and custom front fronting, both friend and trusted friend members
        await testFrontAccess(acc1_legacy.id, acc3_legacy.token, 4, "Friend, Trusted Friend", "Friend, Trusted Friend")

        // Expect no access to fronters
        await testNoFrontAccess(acc1_legacy.id, acc4_legacy.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1_legacy.id, acc5_legacy.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1_legacy.id, acc6_legacy.token)

        // Expect no access to fronters
        await testNoFrontAccess(acc1_legacy.id, acc7_legacy.token)
  
      });
});
