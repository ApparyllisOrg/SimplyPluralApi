import { auth } from "firebase-admin";

import { Request, Response } from "express";
import { FullApiAccess, validateApiKey } from "../modules/api/keys";
import { logSecurity } from "../modules/logger";
import { logUserUsage } from "../modules/usage";
import { validateParams, validatePostId } from "../util/validation";
import { isJwtValid } from "../api/v1/auth/auth.jwt";
import { getCollection } from "../modules/mongo";

export const validateToken = async (tokenStr: string): Promise<{ uid: string | undefined; accessType: number; jwt: boolean }> => {
	if (tokenStr == null) return { uid: undefined, accessType: 0, jwt: false };

	try {
		const token = await auth().verifyIdToken(tokenStr);

		const existingUser = await getCollection("accounts").findOne({ uid: token.uid });
		if (existingUser) {
			return { uid: undefined, accessType: 0x00, jwt: false };
		}

		return { uid: token.uid, accessType: FullApiAccess, jwt: true };
	} catch (e) {
		const result = await validateApiKey(tokenStr);
		if (result.valid === true) {
			return { uid: result.uid, accessType: result.accessType, jwt: false };
		} else {
			const jwtResult = await isJwtValid(tokenStr, false);
			if (jwtResult.valid === true) {
				return { uid: jwtResult.decoded.uid ?? jwtResult.decoded.sub, accessType: FullApiAccess, jwt: true };
			}
		}
		return { uid: undefined, accessType: 0x00, jwt: false };
	}
};

const getIp = (req: Request): string => {
	const connectingHeaders = req.headers["cf-connecting-ip"] ?? [];
	if (Array.isArray(connectingHeaders) && connectingHeaders.length > 0) {
		return connectingHeaders[0] ?? "Unknown";
	}

	return req.ip;
};

const rejectEntry = (req: Request, res: Response, msg: string, ip: string) => {
	logSecurity(`[${ip}] Attempted to access the API at ${req.originalUrl} but was rejected because: ${msg}`);
	return res.status(401).send(msg);
};

export type authMiddleware = (req: Request, _res: Response, _next: any) => void;
export const isUserAuthenticated = function (accessRequested: number, skipPostIdCheck?: boolean): authMiddleware {
	return async (req: Request, res: Response, next: any) => {
		const authorization = req.headers.authorization;

		if (authorization == null || authorization == undefined) {
			return rejectEntry(req, res, "An authorization token is required.", getIp(req));
		}

		const result = await validateToken(req.headers.authorization as string);

		if (!result.uid) return rejectEntry(req, res, "Authorization token is missing or invalid.", getIp(req));

		if (!(result.accessType & accessRequested)) {
			return rejectEntry(req, res, "Authorization token does not have the requested permissions.", getIp(req));
		}

		res.locals.uid = result.uid;
		res.locals.jwt = result.jwt;

		if (!validateParams(req, res)) {
			return;
		}

		if (skipPostIdCheck !== true && !validatePostId(req, res)) {
			return;
		}

		next();

		logUserUsage(res.locals.uid, `${req.method} - ${req.route.path}`);
	};
};

export const isUserAppJwtAuthenticated = async (req: Request, res: Response, next: any) => {
	const authorization = req.headers.authorization;

	if (authorization == null || authorization == undefined) {
		return rejectEntry(req, res, "An authorization token is required.", getIp(req));
	}

	const result = await validateToken(req.headers.authorization as string);

	if (result.jwt === true && result.accessType === FullApiAccess) {
		if (!validateParams(req, res)) {
			return;
		}

		res.locals.uid = result.uid;
		next();
		return;
	}
	return rejectEntry(req, res, "You require to be authenticated using a JWT.", getIp(req));
};
