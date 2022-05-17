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
		new winston.transports.File({ filename: "/var/log/simply-plural/warn.log", level: "warn", maxsize: 1000000 }),
		new winston.transports.File({ filename: "/var/log/simply-plural/combined.log", maxsize: 1000000, }),
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