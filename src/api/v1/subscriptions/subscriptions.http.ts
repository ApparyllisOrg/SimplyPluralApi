import assert from "assert"
import axios, { AxiosResponse } from "axios"
import { getLemonKey, getLemonURL } from "./subscriptions.core"

export const getLemonRequestOptions = () => {
    return { headers: { 'Authorization': `Bearer ${getLemonKey()}` } }
}

export const getRequestLemon = async (path: string): Promise<{ success: boolean, data: any }> => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    const result = await axios.get(`${getLemonURL()}/${path}`, getLemonRequestOptions()).catch((error: AxiosResponse) => 
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(error)
        }
        return undefined;

    })
    if (!result) {
        return { success: false, data: undefined }
    }

    if (result.status === 200) {
        return { success: true, data: result.data }
    }

    return { success: false, data: undefined }
}

export const postRequestLemon = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return await axios.post(`${getLemonURL()}/${path}`, data, getLemonRequestOptions()).catch((e: AxiosResponse) => e)
}

export const patchRequestLemon = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return axios.patch(`${getLemonURL()}/${path}`, data, getLemonRequestOptions()).catch((e: AxiosResponse) => e)
}

export const deleteRequestLemon = async (path: string) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return axios.delete(`${getLemonURL()}/${path}`, getLemonRequestOptions()).catch((e: AxiosResponse) => e)
}