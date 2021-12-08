import winston, { format, transports } from "winston";

export const logger = winston.createLogger({
	level: "info",
	defaultMeta: { service: "user-service" },
	format: format.combine(
		format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))
	),
	transports: [
		new winston.transports.File({ filename: "error.log", level: "error" }),
		new winston.transports.File({ filename: "security.log", level: "security" }),
		new winston.transports.File({ filename: "combined.log", }),
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
