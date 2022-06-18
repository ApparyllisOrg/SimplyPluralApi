import winston, { format, transports } from "winston";
import dotenv from "dotenv";

dotenv.config();
const logPrefix = process.env.LOGPREFIX ?? (process.env.DBNAME ?? "")

const useCustomLogFilenames = !process.argv.includes("--nologs")
if (!useCustomLogFilenames)
{
	console.log("Running without custom log file names")
}

export const logger = winston.createLogger({
	level: "info",
	defaultMeta: { service: "user-service" },
	format: format.combine(
		format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))
	),
	transports: [
		new winston.transports.File({ filename: useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-error.log` : "error.log", level: "error", maxsize: 1000000 }),
		new winston.transports.File({ filename: useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-warn.log`:  "warn.log", level: "warn", maxsize: 1000000 }),
		new winston.transports.File({ filename: useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-info.log`:  "info.log", level: "info", maxsize: 1000000 }),
		new winston.transports.File({ filename: useCustomLogFilenames ? `/var/log/simply-plural/${logPrefix}-combined.log`:  "combined.log", maxsize: 1000000, }),
	],
	exceptionHandlers: [
		new transports.File({ filename: "exceptions.log" })
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