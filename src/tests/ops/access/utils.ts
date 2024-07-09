import axios from "axios";
import { assert } from "chai";
import { decode } from "jsonwebtoken";
import { getCollection } from "../../../modules/mongo";
import { getTestAxiosUrl } from "../../utils";

export type AccountState = {id: string, token: string}

export const registerAccount = async (accountNumber: number, account: AccountState) : Promise<AccountState> =>
{
    const password = "APasswordTh3tFitsTh3Regexp!";
    const email = `test-access-${accountNumber}@apparyllis.com`
    
    const result = await axios.post(getTestAxiosUrl("v1/auth/register"), { email, password });
    assert(result.data);

    account.token = result.data.access;
    const jwtPayload = decode(result.data.access, { json: true });

    account.id = jwtPayload!.sub!;

    const firstAcc = await getCollection("accounts").findOne({ email });
    assert(firstAcc);
    
    accountNumber++

    return account
}