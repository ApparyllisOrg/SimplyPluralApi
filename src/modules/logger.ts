import winston, { format, transports } from "winston";

export const logger = winston.createLogger({
	level: "info",
	defaultMeta: { service: "user-service" },
	format: format.combine(
		format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))
	),
	transports: [
		new winston.transports.File({ filename: "/var/log/simply-plural/error.log", level: "error", maxsize: 1000000 }),
		new winston.transports.File({ filename: "/var/log/simply-plural/security.log", level: "security", maxsize: 1000000 }),
		new winston.transports.File({ filename: "/var/log/simply-plural/combined.log", maxsize: 1000000, }),
	],
	exceptionHandlers: [
		new transports.File({ filename: "exceptions.log" })
	]
});


export const userLog = (uid: string, message: string) => {
	logger.info("USER: [" + uid + "] " + message);
};

export const log = (message: string) => {
	logger.info("SYSTEM: " + message);
};

export const logSecurity = (message: string) => {
	logger.log("security", message);
};

export const consoleLogTimestamp = (str: string) => {
	const date = new Date();
	console.log(`[${date.getFullYear()}-${date.getMonth()}-${date.getDay()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}-${date.getMilliseconds()}] ${str}`)
}