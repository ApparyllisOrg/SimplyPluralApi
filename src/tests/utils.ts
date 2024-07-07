import assert from "assert";
import { ObjectId } from "mongodb";
import { parseId } from "../modules/mongo";
import axios from "axios";

let _token = "";

export const setTestToken = (token: string) => {
	_token = token;
};

export const getTestToken = () => _token;

export const getTestAxiosUrl = (route: string) => "http://localhost:3000/" + route;

export const sleep = (millis: number) => {
	return new Promise((resolve) => setTimeout(resolve, millis));
};

export type TestDocument = (document: any) => boolean;

export const getIdWhere = (documentArray : {id: ObjectId, content: any}[], test: TestDocument) : ObjectId | undefined =>
{
	if (Array.isArray(documentArray))
	{
		for (let i = 0; i < documentArray.length; ++i)
		{
			if (test(documentArray[i].content))
			{
				return documentArray[i].id
			}
		}

		assert(false, "Passed in documentArray does not contain your test") 
		return undefined
	}

	assert(false, "Passed in documentArray is not an array!") 
	return undefined
}

export const postDocument = async (url: string, uid: string, token: string, data: any) : Promise<any> => 
{
	const result = await axios.post(getTestAxiosUrl(url), data, { headers: { authorization: token } })
	assert(result.status === 200)

	const getResult = await axios.get(getTestAxiosUrl(`${url}/${uid}/${result.data}`), { headers: { authorization: token } })
	assert(getResult.status === 200)

	return getResult.data
}