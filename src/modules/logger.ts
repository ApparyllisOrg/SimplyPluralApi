import winston, { format } from "winston";
import dotenv from "dotenv";
import "winston-daily-rotate-file"
import { namedArguments } from "../util/args";

dotenv.config();
const logPrefix = process.env.LOGPREFIX ?? (process.env.DBNAME ?? "")

const useCustomLogFilenames = namedArguments.nologs !== true
if (!useCustomLogFilenames)
{
	console.log("Running without custom log file names")
}

const errorTransport = new winston.transports.DailyRotateFile({
	filename:  useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-error-%DATE%.log` : `error-%DATE%.log`,
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	level: "error"
});

const warnTransport = new winston.transports.DailyRotateFile({
	filename:  useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-warn-%DATE%.log` : `warn-%DATE%.log`,
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	level: "warn"
});

const infoTransport = new winston.transports.DailyRotateFile({
	filename:  useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-info-%DATE%.log` : `info-%DATE%.log`,
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	level: "info"
});

const exceptionstransform = new winston.transports.DailyRotateFile({
	filename:  useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-exceptions-%DATE%.log` : `exceptions-%DATE%.log`,
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	maxSize: '20m'
});

export const logger = winston.createLogger({
	level: "info",
	defaultMeta: { service: "user-service" },
	format: format.combine(
		format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))
	),
	transports: process.env.DEVELOPMENT ? undefined : [
		errorTransport,
		warnTransport,
		infoTransport
	],
	exceptionHandlers: process.env.DEVELOPMENT ? undefined : [
		exceptionstransform
	]
});

export const userLog = (uid: string, message: string) => {
	const msg = "USER: [" + uid + "] " + message
	if (process.env.DEVELOPMENT) {
		console.log(msg)
	}
	logger.info(msg);
};

export const log = (message: string) => {
	const msg = "SYSTEM: " + message
	if (process.env.DEVELOPMENT) {
		console.log(msg)
	}
	logger.info(msg);
};

export const logSecurity = (message: string) => {
	if (process.env.DEVELOPMENT) {
		console.log(message)
	}
	logger.log("warn", message);
};

export const consoleLogTimestamp = (str: string) => {
	const date = new Date();
	console.log(`[${date.getFullYear()}-${date.getMonth()}-${date.getDay()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}-${date.getMilliseconds()}] ${str}`)
}