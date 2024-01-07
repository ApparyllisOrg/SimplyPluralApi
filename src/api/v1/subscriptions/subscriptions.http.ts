import assert from "assert"
import axios from "axios"
import { getPaddleKey, getPaddleURL } from "./subscriptions.core"

const getOptions = () => {
    return { headers: { 'Authorization': `Bearer ${getPaddleKey()}` } }
}

export const getRequestPaddle = async (path: string): Promise<{ success: boolean, data: any }> => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    const result = await axios.get(`${getPaddleURL()}/${path}`, getOptions()).catch((error) => undefined)
    if (!result) {
        return { success: false, data: undefined }
    }

    if (result.status === 200) {
        return { success: true, data: JSON.parse(result.data) }
    }

    return { success: false, data: undefined }
}

export const postRequestPaddle = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return await axios.post(`${getPaddleURL()}/${path}`, data, getOptions())
}

export const patchRequestPaddle = async (path: string, data: any) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    return axios.patch(`${getPaddleURL()}/${path}`, data, getOptions())
}

export const deleteRequestPaddle = async (path: string) => {
    if (path.startsWith('/')) {
        assert(`Cannot create a request for path ${path} that start with a /`)
    }

    axios.delete(`${getPaddleURL()}/${path}`, getOptions())
}