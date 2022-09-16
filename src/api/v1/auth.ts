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
		await getCollection("securityLogs").insertOne({uid: user.uid, at: moment.now(), action: "Logged in from " + req.ip})
	} else {
		res.status(401).send("Unknown user or password")
	}
}

export const loginGoogle = async (req: Request, res: Response) => {
	const result = await loginWithGoogle(req.body.credential, false);
	if (result.success === true)
	{
		getCollection("securityLogs").insertOne({uid: result.uid, at: moment.now(), action: "Logged in from " + req.ip})
		return res.status(200).send(result.uid);
	}

	return res.status(401).send();
}

export const registerGoogle = async (req: Request, res: Response) => {
	const result = await loginWithGoogle(req.body.credential, true);
	if (result.success === true)
	{
		getCollection("securityLogs").insertOne({uid: result.uid, at: moment.now(), action: "Registered from " + req.ip})
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
			// Invalidate this refresh token
			getCollection("invalidJwtTokens").insertOne({jwt: req.headers.authorization})
			res.status(200).send(jwtForUser(validResult.decoded.uid))
		}
	} else {
		res.status(401).send("Invalid jwt")
	}
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
	await getCollection("securityLogs").insertOne({uid: newUserId, at: moment.now(), action: "Registerd your user account from " + req.ip})
	sendConfirmationEmail(newUserId)
}

export const requestConfirmationEmail = async (req: Request, res: Response) => {
	const result : { success: boolean, msg: string }= await sendConfirmationEmail(res.locals.uid)
	if (result.success === true)
	{
		await getCollection("securityLogs").insertOne({uid: res.locals.uid, at: moment.now(), action: "Requested confirm email"})
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
		await getCollection("securityLogs").insertOne({uid: req.query.uid?.toString() ?? "", at: moment.now(), action: "Confirmed your email"})
		res.status(200).send("Email confirmed")
	}
	else 
	{
		res.status(400).send("Invalid confirmation link")
	}
}

export const validateRegisterSchema = (body: any): { success: boolean, msg: string } => {
	const schema = {
		type: "object",
		properties: {
			email: { type: "string", format: "email"  },
			password: { type: "string", pattern: "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{10,100}$",  }
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