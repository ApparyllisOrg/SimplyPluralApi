import axios, { AxiosError, AxiosResponse } from "axios";
import { logger } from "../../logger";
import * as Sentry from "@sentry/node";

export enum PkRequestType {
	Get,
	Post,
	Patch
}

export interface PkRequest {
	path: string,
	token: string,
	data: any | undefined,
	type: PkRequestType,
	response: AxiosResponse<any> | null
}

const pendingRequests: Array<PkRequest> = []
const pendingResponses: Array<PkRequest> = []

let remainingRequestsThisSecond = 0;

export const addPendingRequest = (request: PkRequest): Promise<AxiosResponse<any> | null> => {
	return new Promise(function (resolve) {
		// Add as pending request
		pendingRequests.push(request);

		// Wait until request was answered
		(function waitForAnswer() {
			const index = pendingResponses.indexOf(request)
			if (index >= 0) {
				const response = pendingResponses[index]
				pendingResponses.splice(index, 1)
				return resolve(response.response)
			}

			setTimeout(waitForAnswer, 50);
		})();
	});
}

export const startPkController = () => {
	reportActiveQueueSize();
	tick()
	resetRequestCounter();
}

export const resetRequestCounter = () => {
	remainingRequestsThisSecond = 20;
	setTimeout(resetRequestCounter, 1000)
}

export const reportActiveQueueSize = () => {
	console.log("Active pk controller queue size: " + pendingRequests.length.toString())
	setTimeout(reportActiveQueueSize, 10000)
}

const handleError = (reason: AxiosError) => {
	if (reason.response) {
		return reason.response;
	}
	return null;
}

export const tick = async () => {
	try {
		if (remainingRequestsThisSecond > 0) {
			for (let i = 0; (i < remainingRequestsThisSecond && i < 2) && i < pendingRequests.length; ++i) {
				dispatchTickRequests(pendingRequests[i]);
				pendingRequests.splice(0, 1)
				remainingRequestsThisSecond--;
			}
		}
	}
	catch (e) {
		console.log(e);
		logger.error("Pk sync error: " + e)
		Sentry.captureException(e);
	}

	setTimeout(tick, 10)
}

export const dispatchTickRequests = async (request: PkRequest) => {
	const type = request.type;
	switch (type) {
		case PkRequestType.Get: {
			const result = await axios.get(request.path, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError)
			request.response = result
			pendingResponses.push(request)
			break
		}
		case PkRequestType.Post: {
			const result = await axios.post(request.path, request.data, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError)
			request.response = result
			pendingResponses.push(request)
			break
		}
		case PkRequestType.Patch: {
			const result = await axios.patch(request.path, request.data, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError)
			request.response = result
			pendingResponses.push(request)
			break
		}
	}
}