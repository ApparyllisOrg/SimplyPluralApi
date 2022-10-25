import { Request, Response } from "express";
import { getCollection } from "../../modules/mongo";
import { validateSchema } from "../../util/validation";
import { randomBytes, timingSafeEqual } from "crypto"; 
import { confirmUserEmail, getConfirmationKey, sendConfirmationEmail } from "./auth/auth.confirmation";
import { base64decodeJwt, isJwtValid, jwtForUser } from "./auth/auth.jwt";
import { hash } from "./auth/auth.hash";
import { getNewUid } from "./auth/auth.core";
import moment from "moment";
import { loginWithGoogle } from "./auth/auth.google";
import { auth } from "firebase-admin";
import { resetPassword_Exection, resetPasswordRequest_Execution } from "./auth/auth.resetPassword";
import { changeEmail_Execution } from "./auth/auth.changeEmail";
import { changePassword_Execution } from "./auth/auth.changePassword";
import { logSecurityUserEvent } from "../../security";

export const login = async (req: Request, res: Response) => {
	const user = await getCollection("accounts").findOne({email: req.body.email})
	if (!user)
	{
		res.status(401).send("Unknown user or password")
		return
	}
	const hashedPasswd = await hash(req.body.password, user.salt)

	const knownHash = base64decodeJwt(user.password)
	const bGeneratedHash = base64decodeJwt(hashedPasswd.hashed)

	if (bGeneratedHash.length !== knownHash.length) {
		res.status(401).send("Unknown user or password")
		return
	}

	if (timingSafeEqual(bGeneratedHash, knownHash)) {
		res.status(200).send(jwtForUser(user.uid));
		logSecurityUserEvent(user.uid, "Logged in ", req.ip)
	} else {
		res.status(401).send("Unknown user or password")
	}
}

export const loginGoogle = async (req: Request, res: Response) => {
	const result = await loginWithGoogle(req.body.credential, false);
	if (result.success === true)
	{
		logSecurityUserEvent(result.uid, "Logged in", req.ip)
		return res.status(200).send(result.uid);
	}

	return res.status(401).send();
}

export const registerGoogle = async (req: Request, res: Response) => {
	const result = await loginWithGoogle(req.body.credential, true);
	if (result.success === true)
	{
		logSecurityUserEvent(result.uid, "Registers", req.ip)
		return res.status(200).send(result.uid);
	}

	return res.status(401).send();
}

export const refreshToken = async (req: Request, res: Response) => {
	if (!req.headers.authorization)
	{
		res.status(400).send("You need to include the authorization header")
		return
	}

	const validResult = await isJwtValid(req.headers.authorization, true);
	if (validResult.valid === true && validResult.decoded.refresh === true) {
		const invalidatedToken = await getCollection("invalidJwtTokens").findOne({jwt: req.headers.authorization})
		if (invalidatedToken) {
			res.status(401).send("Invalid jwt")
		} else {
			const user = await getCollection("accounts").findOne({uid: validResult.decoded.uid})

			// No first valid jwt means means all jwts issues from apparyllis are valid, as long as they're not expired
			if (user.firstValidJWtTime && validResult.decoded.iat < user.firstValidJWtTime)
			{
				res.status(401).send("Invalid jwt")
				return;
			}

			const newToken = jwtForUser(validResult.decoded.uid)
			// Invalidate used refresh token
			getCollection("invalidJwtTokens").insertOne({jwt: req.headers.authorization})

			res.status(200).send(newToken)
		}
	} else {
		res.status(401).send("Invalid jwt")
	}
}

export const resetPasswordRequest = async (req: Request, res: Response) =>
{
	const email =  req.query.email?.toString() ?? ""
	const result = await resetPasswordRequest_Execution(email)
	if (result.success === true)
	{
		const user = await getCollection("accounts").findOne({email})
		// User may not exist if they haven't migrated from firebase to native-auth yet
		// TODO: Phase this out whenever we lock out firebase-auth-dependent app client versions 
		if (user)
		{
			logSecurityUserEvent(user.uid, "Requested a password reset", req.ip)
		}
	} 

	res.status(200).send("If an account exists under this email you will receive a reset password email shortly.")
}


export const resetPassword = async (req: Request, res: Response) =>
{
	const result = await resetPassword_Exection(req.body.resetKey, req.body.newPassword)
	if (result.success === true)
	{
		logSecurityUserEvent(result.uid, "Changed your password", req.ip)
		res.status(200).send("Password changed succesfully!")
	} 

	res.status(401).send(result.msg)
}

export const changeEmail = async (req: Request, res: Response) =>
{
	const result = await changeEmail_Execution(req.body.oldEmail, req.body.password, req.body.newEmail)
	if (result.success === true)
	{
		logSecurityUserEvent(result.uid, "Changed email from " + req.body.oldEmail + " to " + req.body.newEmail, req.ip)
		res.status(200).send("Email changed succesfully!")
	} 

	res.status(401).send(result.msg)
}

export const changePassword = async (req: Request, res: Response) =>
{
	const result = await changePassword_Execution(req.body.uid, req.body.oldPassword, req.body.newPassword)
	if (result.success === true)
	{
		logSecurityUserEvent(result.uid, "Changed password", req.ip)
		// TODO: Send new refresh token
		res.status(200).send("Password changed succesfully!")
		return;
	} 

	res.status(401).send("Failed to change password")
}

export const register = async (req: Request, res: Response) => {
	const existingUser = await getCollection("accounts").findOne({email: req.body.email})
	if (existingUser)
	{
		res.status(409).send("User already exists")
		return;
	}

	const salt = randomBytes(16).toString("hex")
	const newUserId = await getNewUid()
	const hashedPasswd = await hash(req.body.password, salt)
	const verificationCode = getConfirmationKey()
	await getCollection("accounts").insertOne({uid: newUserId, email: req.body.email, password: hashedPasswd.hashed, salt, verificationCode});
	res.status(200).send({uid: newUserId, jwt: jwtForUser(newUserId)})

	logSecurityUserEvent(newUserId, "Registerd your user account", req.ip)

	sendConfirmationEmail(newUserId)
}

export const requestConfirmationEmail = async (req: Request, res: Response) => {
	const result : { success: boolean, msg: string }= await sendConfirmationEmail(res.locals.uid)
	if (result.success === true)
	{
		logSecurityUserEvent(res.locals.uid, "Requested confirm email", req.ip)
		res.status(200).send()
	} 
	else 
	{
		res.status(400).send(result.msg)
	}
}

export const confirmEmail = async (req: Request, res: Response) => {
	const result = await confirmUserEmail(req.query.uid?.toString() ?? "", req.query.key?.toString() ?? "")

	// TODO: Send a html web page so this is prettier
	if (result === true)
	{
		logSecurityUserEvent(req.query.uid?.toString() ?? "", "Confirmed your email", req.ip);
		res.status(200).send("Email confirmed")
	}
	else 
	{
		res.status(401).send("Invalid confirmation link")
	}
}

const getPasswordRegex = () => "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,100}$"

export const validateRegisterSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			email: { type: "string", format: "email"  },
			password: { type: "string", pattern: getPasswordRegex(),  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["email", "password"]
	};

	return validateSchema(schema, body);
}

export const validateConfirmEmailSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			uid: { type: "string", pattern: "^[a-zA-Z0-9]{64}$" },
			key: { type: "string", pattern: "^[a-zA-Z0-9]{128}$" }
		},
		nullable: false,
		additionalProperties: false,
		required: ["key"]
	};

	return validateSchema(schema, body);
}

export const validateLoginGoogleSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			credential: { type: "string" },
		},
		nullable: false,
		additionalProperties: false,
		required: ["credential"]
	};

	return validateSchema(schema, body);
}

export const validateResetPasswordRequestSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			email: { type: "string", format: "email"  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["email"]
	};

	return validateSchema(schema, body);
}

export const validateResetPasswordExecutionSchema = (body: any): { success: boolean, msg: string } => {

	const schema = {
		type: "object",
		properties: {
			resetKey: { type: "string", pattern: "^[a-zA-Z0-9]{128}$" },
			newPassword: { type: "string", pattern: getPasswordRegex()  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["resetKey", "newPassword"]
	};

	return validateSchema(schema, body);
}

export const validateChangePasswordSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			uid: { type: "string", pattern: "^[a-zA-Z0-9]{20,64}$" },
			oldPassword: { type: "string", pattern: getPasswordRegex() },
			newPassword: { type: "string", pattern: getPasswordRegex() }
		},
		nullable: false,
		additionalProperties: false,
		required: ["uid", "oldPassword", "newPassword"]
	};

	return validateSchema(schema, body);
}

export const validateChangeEmailSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			oldEmail: { type: "string", format: "email"  },
			password: { type: "string", pattern: getPasswordRegex() },
			newEmail: { type: "string", format: "email"  }
		},
		nullable: false,
		additionalProperties: false,
		required: ["oldEmail", "password", "newEmail"]
	};

	return validateSchema(schema, body);
}
