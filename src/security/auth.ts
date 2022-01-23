import { auth } from "firebase-admin";

import { Request, Response } from "express";
import { FullApiAccess, validateApiKey } from "../modules/api/keys";
import { logSecurity } from "../modules/logger";
import { logUserUsage } from "../modules/usage";

export const validateToken = async (tokenStr: string): Promise<{ uid: string | undefined, accessType: number, jwt: boolean }> => {
	if (tokenStr == null)
		return { uid: undefined, accessType: 0, jwt: false };

	try {
		const token = await auth().verifyIdToken(tokenStr);
		return { uid: token.uid, accessType: FullApiAccess, jwt: true }
	}
	catch (e) {
		const result = await validateApiKey(tokenStr)
		return { uid: result.uid, accessType: result.accessType, jwt: false }
	}
}

const rejectEntry = (req: Request, res: Response, msg: string, ip: string) => {
	logSecurity(`[${ip}] Attempted to access the API at ${req.route} but was rejected because: ${msg}`);
	return res.status(401).send(msg);
}

export type authMiddleware = (_req: Request, _res: Response, _next: any) => void
export const isUserAuthenticated = function (accessRequested: number): authMiddleware {
	return async (req: Request, res: Response, next: any) => {

		const authorization = req.headers.authorization;

		if (authorization == null || authorization == undefined) {
			return rejectEntry(req, res, "An authorization token is required.", req.ip);
		}

		const result = await validateToken(req.headers.authorization as string);
		if (!result.uid)
			return rejectEntry(req, res, "Authorization token is missing or invalid.", req.ip);

		if (!(result.accessType & accessRequested)) {
			return rejectEntry(req, res, "Authorization token does not have the requested permissions.", req.ip);
		}

		res.locals.uid = result.uid;
		res.locals.jwt = result.jwt;

		next();

		logUserUsage(res.locals.uid, `${req.method} - ${req.route.path}`);
	}
};


// Only accept updates from user-agent Dart.
// We know this can easily be circumvented, but this is sp-app-specific data
// That no client can read, or edit unless they can authenticate with jwt.

export const isUserAppJwtAuthenticated = async (req: Request, res: Response, next: any) => {

	const authorization = req.headers.authorization;

	if (authorization == null || authorization == undefined) {
		return rejectEntry(req, res, "An authorization token is required.", req.ip);
	}

	const result = await validateToken(req.headers.authorization as string);

	if (result.jwt === true && result.accessType === FullApiAccess) {
		res.locals.uid = result.uid;
		if (req.header("User-Agent")?.startsWith("Dart") === true) {
			next();
			logUserUsage(res.locals.uid, `${req.method} - ${req.route.path}`);
			return;
		}
		return rejectEntry(req, res, "You require to be a Dart agent to authenticate.", req.ip);
	}
	return rejectEntry(req, res, "You require to be authenticated using a JWT.", req.ip);
}
