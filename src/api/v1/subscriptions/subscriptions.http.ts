import assert from "assert"
import axios, { AxiosResponse } from "axios"
import { getPaddleKey, getPaddleURL } from "./subscriptions.core"

export const getPaddleRequestOptions = () => {
    return { headers: { 'Authorization': `Bearer ${getPaddleKey()}` } }
}

export const getRequestPaddle = async (path: string): Promise<{ success: boolean, data: any }> => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    const result = await axios.get(`${getPaddleURL()}/${path}`, getPaddleRequestOptions()).catch((error: AxiosResponse) => 
    {
        if (process.env.DEVELOPMENT)
        {
            console.log(error.status)
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

export const postRequestPaddle = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return await axios.post(`${getPaddleURL()}/${path}`, data, getPaddleRequestOptions()).catch((e: AxiosResponse) => e)
}

export const patchRequestPaddle = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return axios.patch(`${getPaddleURL()}/${path}`, data, getPaddleRequestOptions()).catch((e: AxiosResponse) => e)
}

export const deleteRequestPaddle = async (path: string) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    axios.delete(`${getPaddleURL()}/${path}`, getPaddleRequestOptions()).catch((e: AxiosResponse) => e)
}