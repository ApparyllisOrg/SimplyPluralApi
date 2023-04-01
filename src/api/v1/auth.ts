import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { validateSchema } from "../../util/validation";
import { randomBytes, timingSafeEqual } from "crypto";
import { confirmUserEmail, getConfirmationKey, sendConfirmationEmail } from "./auth/auth.confirmation";
import { base64decodeJwt, isJwtValid, jwtForUser } from "./auth/auth.jwt";
import { hash } from "./auth/auth.hash";
import { getEmailRegex, getNewUid, getPasswordRegex, getPasswordRegexString } from "./auth/auth.core";
import moment from "moment";
import { loginWithGoogle } from "./auth/auth.google";
import { auth } from "firebase-admin";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { resetPassword_Exection, resetPasswordRequest_Execution } from "./auth/auth.resetPassword";
import { changeEmail_Execution } from "./auth/auth.changeEmail";
import { changePassword_Execution } from "./auth/auth.changePassword";
import { isUserSuspended, logSecurityUserEvent } from "../../security";
import { initializeApp } from "firebase/app";
import { loginWithApple } from "./auth/auth.apple";
import { namedArguments } from "../../util/args";
import { requestEmail_Execution } from "./auth/auth.requestEmail";
import { logOpenUsage as logDailyUsage } from "./events/open";
import { migrateAccountFromFirebase } from "./auth/auth.migrate";
import { fetchCollection } from "../../util";

initializeApp({ projectId: process.env.GOOGLE_CLIENT_JWT_AUD, apiKey: process.env.GOOGLE_API_KEY });

export const login = async (req: Request, res: Response) => {
	let user = await getCollection("accounts").findOne({ email: getEmailRegex(req.body.email) });
	if (!user) {
		const result = await signInWithEmailAndPassword(getAuth(), req.body.email, req.body.password).catch(() => undefined);
		if (result) {
			const salt = randomBytes(16).toString("hex");
			const hashedPasswd = await hash(req.body.password, salt);
			await getCollection("accounts").insertOne({ uid: result.user.uid, email: req.body.email, verified: result.user.emailVerified, salt, password: hashedPasswd.hashed, registeredAt: result.user.metadata.creationTime ?? moment.now() });
			user = await getCollection("accounts").findOne({ email: getEmailRegex(req.body.email) });
			migrateAccountFromFirebase(user.uid);
		} else {
			res.status(401).send("Unknown user or password");
			return;
		}
	}

	if (user.oAuth2 === true) {
		res.status(401).send("You cannot login with password for an account with Google Sign-in or Apple Sign-in enabled");
		return;
	}

	const hashedPasswd = await hash(req.body.password, user.salt);

	const knownHash = base64decodeJwt(user.password);
	const bGeneratedHash = base64decodeJwt(hashedPasswd.hashed);

	if (bGeneratedHash.length !== knownHash.length) {
		res.status(401).send("Unknown user or password");
		return;
	}

	if (timingSafeEqual(bGeneratedHash, knownHash)) {
		const isSuspended = await isUserSuspended(user.uid);
		if (isSuspended) {
			res.status(401).send("Your account is suspended");
			return;
		}

		const jwt = await jwtForUser(user.uid, undefined, undefined);
		res.status(200).send(jwt);
		logSecurityUserEvent(user.uid, "Logged in ", req);
	} else {
		res.status(401).send("Unknown user or password");
	}
};

export const loginGoogle = async (req: Request, res: Response) => {
	const result = await loginWithGoogle(req.body.credential);
	if (result.success === true) {
		const isSuspended = await isUserSuspended(result.uid);
		if (isSuspended) {
			res.status(401).send("Your account is suspended");
			return;
		}

		logSecurityUserEvent(result.uid, "Logged in", req);
		const jwt = await jwtForUser(result.uid, undefined, undefined);
		return res.status(200).send(jwt);
	}

	return res.status(401).send();
};

export const loginApple = async (req: Request, res: Response) => {
	const result = await loginWithApple(req.body.credential);
	if (result.success === true) {
		const isSuspended = await isUserSuspended(result.uid);
		if (isSuspended) {
			res.status(401).send("Your account is suspended");
			return;
		}

		logSecurityUserEvent(result.uid, "Logged in", req);
		const jwt = await jwtForUser(result.uid, undefined, undefined);
		return res.status(200).send(jwt);
	}

	return res.status(401).send();
};

export const refreshToken = async (req: Request, res: Response) => {
	if (!req.headers.authorization) {
		res.status(400).send("You need to include the authorization header");
		return;
	}

	const validResult = await isJwtValid(req.headers.authorization, true);

	if (validResult.valid === true) {
		if (validResult.google === false && validResult.decoded.refresh === true) {
			const isSuspended = await isUserSuspended(validResult.decoded.sub);
			if (isSuspended) {
				res.status(401).send("Your account is suspended");
				return;
			}

			let email = undefined;

			const user = await getCollection("accounts").findOne({ uid: validResult.decoded.sub });
			if (!user) {
				const firebaseUser = await auth().getUser(validResult.decoded.sub);
				email = firebaseUser.email;
			} else {
				email = user.email;
			}

			const newToken = await jwtForUser(validResult.decoded.sub, email, true);

			res.status(200).send(newToken);

			// Infer daily usage from a token refresh
			logDailyUsage(validResult.decoded.sub);

			return;
		} else if (validResult.google === true) {
			const newToken = await jwtForUser(validResult.decoded, validResult.email, true);
			res.status(200).send(newToken);

			// Infer daily usage from a token refresh
			logDailyUsage(validResult.decoded);

			return;
		}
	}

	res.status(401).send("Invalid jwt");
};

export const checkRefreshTokenValidity = async (req: Request, res: Response) => {
	if (!req.headers.authorization) {
		res.status(400).send("You need to include the authorization header");
		return;
	}

	const validResult = await isJwtValid(req.headers.authorization, true);
	if (validResult.valid === true && validResult.decoded.refresh === true) {
		res.status(200).send();
	} else {
		res.status(401).send("Invalid jwt");
	}
};

export const resetPasswordRequest = async (req: Request, res: Response) => {
	const email = req.query.email?.toString() ?? "";
	const result = await resetPasswordRequest_Execution(email);
	if (result.success === true) {
		const user = await getCollection("accounts").findOne({ email: getEmailRegex(email) });
		// User may not exist if they haven't migrated from firebase to native-auth yet
		// TODO: Phase this out whenever we lock out firebase-auth-dependent app client versions
		if (user) {
			logSecurityUserEvent(user.uid, "Requested a password reset", req);
		}
	}

	res.status(200).send("If an account exists under this email, you will receive a reset password email shortly.");
};

export const resetPassword = async (req: Request, res: Response) => {
	const result = await resetPassword_Exection(req.body.resetKey, req.body.newPassword);
	if (result.success === true) {
		logSecurityUserEvent(result.uid, "Changed your password", req);

		const isSuspended = await isUserSuspended(result.uid);
		if (isSuspended) {
			res.status(200).send("Password changed, but your account is suspended so you will not be able to login");
			return;
		} else {
			const newToken = await jwtForUser(result.uid, undefined, undefined);
			res.status(200).send(newToken);
			return;
		}
	}

	res.status(401).send(result.msg);
};

export const changeEmail = async (req: Request, res: Response) => {
	const result = await changeEmail_Execution(req.body.oldEmail, req.body.password, req.body.newEmail);
	if (result.success === true) {
		logSecurityUserEvent(result.uid, "Changed email from " + req.body.oldEmail + " to " + req.body.newEmail, req);

		const isSuspended = await isUserSuspended(result.uid);
		if (isSuspended) {
			res.status(200).send("Email changed, but your account is suspended so you will not be able to login");
			return;
		} else {
			const newToken = await jwtForUser(result.uid, undefined, undefined);
			res.status(200).send(newToken);
			return;
		}
	}

	res.status(401).send(result.msg);
};

export const changePassword = async (req: Request, res: Response) => {
	const result = await changePassword_Execution(req.body.uid, req.body.oldPassword, req.body.newPassword);
	if (result.success === true) {
		logSecurityUserEvent(result.uid, "Changed password", req);

		const isSuspended = await isUserSuspended(result.uid);
		if (isSuspended) {
			res.status(200).send("Password changed, but your account is suspended so you will not be able to login");
			return;
		} else {
			const newToken = await jwtForUser(result.uid, undefined, undefined);
			res.status(200).send(newToken);
			return;
		}
	}

	res.status(401).send("Failed to change password");
};

export const requestEmailFromUsername = async (req: Request, res: Response) => {
	const result = await requestEmail_Execution(req.body.username);
	if (result.success === true) {
		res.status(200).send(result.msg);
		return;
	}

	res.status(500).send("Error");
};

export const getAuthLogs = async (req: Request, res: Response) => {
	fetchCollection(req, res, "securityLogs", {});
};

export const register = async (req: Request, res: Response) => {
	const existingUser = await getCollection("accounts").findOne({ email: getEmailRegex(req.body.email) });
	if (existingUser) {
		res.status(409).send("User already exists");
		return;
	}

	if (namedArguments.without_google === false) {
		const firebaseUser = await auth()
			.getUserByEmail(req.body.email)
			.catch(() => {
				return undefined;
			});

		if (firebaseUser) {
			res.status(403).send("User already exists");
			return;
		}
	}

	if (!getPasswordRegex().test(req.body.password as string)) {
		res.status(400).send("Your password must be between 12 and 100 characters, have a capital and lower case letter, a number and a symbol (#?!@$%^&*-)");
		return;
	}

	const salt = randomBytes(16).toString("hex");
	const newUserId = await getNewUid();
	const hashedPasswd = await hash(req.body.password, salt);
	const verificationCode = getConfirmationKey();
	await getCollection("accounts").insertOne({ uid: newUserId, email: req.body.email, password: hashedPasswd.hashed, salt, verificationCode, verified: false, registeredAt: new Date() });
	const jwt = await jwtForUser(newUserId, undefined, undefined);
	res.status(200).send(jwt);

	logSecurityUserEvent(newUserId, "Registered your user account", req);

	sendConfirmationEmail(newUserId);
};

export const requestConfirmationEmail = async (req: Request, res: Response) => {
	const result: { success: boolean; msg: string } = await sendConfirmationEmail(res.locals.uid);
	if (result.success === true) {
		logSecurityUserEvent(res.locals.uid, "Requested confirm email", req);
		res.status(200).send();
	} else {
		res.status(400).send(result.msg);
	}
};

export const confirmEmail = async (req: Request, res: Response) => {
	const result = await confirmUserEmail(req.query.uid?.toString() ?? "", req.query.key?.toString() ?? "");

	// TODO: Send a html web page so this is prettier
	if (result === true) {
		logSecurityUserEvent(req.query.uid?.toString() ?? "", "Confirmed your email", req);
		res.status(200).send("Email confirmed");
	} else {
		res.status(401).send("Invalid confirmation link");
	}
};

export const validateRegisterSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			email: { type: "string", format: "email" },
			password: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["email", "password"],
	};

	return validateSchema(schema, body);
};

export const validateForgotEmailSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			username: { type: "string", pattern: "^[a-zA-Z0-9-_]{1,35}$" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["username"],
	};

	return validateSchema(schema, body);
};

export const validateConfirmEmailSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			// Users registering before 1.8 have a firebase user id (regex `^[A-Za-z0-9]{1,50}$`)
			// Users registering on/after 1.8 have a new auth user id (regex `^[A-Za-z0-9]{64}$`)
			// At a later stage it's probably best to merge those two into an OR check rather than this broad condition
			uid: { type: "string", pattern: "^[a-zA-Z0-9]{1,64}$" },
			key: { type: "string", pattern: "^[a-zA-Z0-9]{128}$" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["key"],
	};

	return validateSchema(schema, body);
};

export const validateLoginOAuth2Schema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			credential: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["credential"],
	};

	return validateSchema(schema, body);
};

export const validateResetPasswordRequestSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			email: { type: "string", format: "email" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["email"],
	};

	return validateSchema(schema, body);
};

export const validateResetPasswordSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			key: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["key"],
	};

	return validateSchema(schema, body);
};

export const validateResetPasswordExecutionSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			resetKey: { type: "string", pattern: "^[a-zA-Z0-9]{128}$" },
			newPassword: { type: "string", pattern: getPasswordRegexString() },
		},
		nullable: false,
		additionalProperties: false,
		required: ["resetKey", "newPassword"],
	};

	return validateSchema(schema, body);
};

export const validateChangePasswordSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			uid: { type: "string", pattern: "^[a-zA-Z0-9]{20,64}$" },
			oldPassword: { type: "string" },
			newPassword: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["uid", "oldPassword", "newPassword"],
	};

	return validateSchema(schema, body);
};

export const validateChangeEmailSchema = (body: unknown): { success: boolean; msg: string } => {
	const schema = {
		type: "object",
		properties: {
			oldEmail: { type: "string", format: "email" },
			password: { type: "string" },
			newEmail: { type: "string", format: "email" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["oldEmail", "password", "newEmail"],
	};

	return validateSchema(schema, body);
};
