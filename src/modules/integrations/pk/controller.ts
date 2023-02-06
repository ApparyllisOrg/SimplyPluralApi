import axios, { AxiosError, AxiosResponse } from "axios";
import { logger } from "../../logger";
import * as Sentry from "@sentry/node";
import { nanoid } from "nanoid";

import promclient from "prom-client";

export enum PkRequestType {
	Get,
	Post,
	Patch,
}

export interface PkRequest {
	path: string;
	token: string;
	data: any | undefined;
	type: PkRequestType;
	response: AxiosResponse<any> | null;
	id: string;
}

const pendingRequests: Array<PkRequest> = [];
let pendingResponses: Array<PkRequest> = [];

let remainingRequestsThisSecond = 0;

export const addPendingRequest = (request: PkRequest): Promise<AxiosResponse<any> | null> => {
	return new Promise(function (resolve) {
		request.id = nanoid();

		// Add as pending request
		pendingRequests.push(request);

		// Wait until request was answered
		(function waitForAnswer() {
			const response = pendingResponses.find((response) => response.id === request.id);

			if (response) {
				pendingResponses = pendingResponses.filter((response) => response.id != request.id);
				return resolve(response.response);
			}

			setTimeout(waitForAnswer, 50);
		})();
	});
};

export const startPkController = () => {
	reportActiveQueueSize();
	tick();
	resetRequestCounter();
};

export const resetRequestCounter = () => {
	remainingRequestsThisSecond = 20;
	setTimeout(resetRequestCounter, 1000);
};

export const reportActiveQueueSize = () => {
	console.log("Active pk controller queue size: " + pendingRequests.length.toString());
	setTimeout(reportActiveQueueSize, 10000);
};

const handleError = (reason: AxiosError) => {
	if (reason.response) {
		return reason.response;
	}
	return null;
};

export const tick = async () => {
	try {
		if (remainingRequestsThisSecond > 0) {
			for (let i = 0; i < remainingRequestsThisSecond && i < 2 && i < pendingRequests.length; ++i) {
				dispatchTickRequests(pendingRequests[i]);
				pendingRequests.splice(i, 1);
				remainingRequestsThisSecond--;
			}
		}
	} catch (e) {
		console.log(e);
		logger.error("Pk sync error: " + e);
		Sentry.captureException(e);
	}

	setTimeout(tick, 100);
};

const counter = new promclient.Counter({
	name: "apparyllis_api_pk_syncs",
	help: "Counter for pk syncs performed",
	labelNames: ["method", "statusCode"],
});

export const dispatchTickRequests = async (request: PkRequest) => {
	let debug = false;
	if (process.env.DEVELOPMENT) {
		debug = true;
	}

	const type = request.type;
	switch (type) {
	case PkRequestType.Get: {
		if (debug) {
			console.log("GET=>" + request.path);
		}
		const result = await axios.get(request.path, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError);
		counter.labels("GET", result?.status.toString() ?? "503").inc(1);
		if (debug) {
			console.log("Response for GET=>" + request.path);
		}
		request.response = result;
		pendingResponses.push(request);
		break;
	}
	case PkRequestType.Post: {
		if (debug) {
			console.log("POST=>" + request.path);
		}
		const result = await axios.post(request.path, request.data, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError);
		counter.labels("POST", result?.status.toString() ?? "503").inc(1);
		if (debug) {
			console.log("Response for POST=>" + request.path);
		}
		request.response = result;
		pendingResponses.push(request);
		break;
	}
	case PkRequestType.Patch: {
		if (debug) {
			console.log("PATCH=>" + request.path);
		}
		const result = await axios.patch(request.path, request.data, { headers: { authorization: request.token, "X-PluralKit-App": process.env.PLURALKITAPP ?? "" } }).catch(handleError);
		counter.labels("PATCH", result?.status.toString() ?? "503").inc(1);
		if (debug) {
			console.log("Response for PATCH=>" + request.path);
		}
		request.response = result;
		pendingResponses.push(request);
		break;
	}
	}
};
