const readEnv = (key: string): string | null => {
	const value = process.env[key]
	if (value === undefined || value === "") return null
	return value
}

const env = (key: string, ...fallbackKeys: string[]): string | null => {
	const value = readEnv(key)
	if (value !== null) return value

	for (const fallback of fallbackKeys) {
		const fallbackValue = readEnv(fallback)
		if (fallbackValue !== null) return fallbackValue
	}

	return null
}

env.required = (key: string, ...fallbackKeys: string[]): string => {
	const value = env(key, ...fallbackKeys)
	if (value === null) {
		const allKeys = [key, ...fallbackKeys].join(", ")
		throw new Error(`Required environment variable not set: ${allKeys}`)
	}
	return value
}

env.int = (key: string, ...fallbackKeys: string[]): number | null => {
	const value = env(key, ...fallbackKeys)
	if (value === null) return null
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed)) {
		throw new Error(`Environment variable ${key} must be an integer, got: ${value}`)
	}
	return parsed
}

env.intWithDefault = (defaultValue: number, key: string, ...fallbackKeys: string[]): number => {
	return env.int(key, ...fallbackKeys) ?? defaultValue
}

env.bool = (key: string, ...fallbackKeys: string[]): boolean => {
	const value = env(key, ...fallbackKeys)
	return value === "true"
}

// --- Server ---

export interface ServerConfig {
	cors: string[] | null
	port: number
	baseUrl: string
}

function getCorsOrgins(): string[] | null {
	const cors = env("CORS_ORIGINS")
	if (!cors || cors === "false") return null

	const origins = cors.split(",").map((origin) => origin.trim())

	if (!origins.length) {
		return null
	}

	return origins
}

function getServerConfig(): ServerConfig {
	return {
		cors: getCorsOrgins(),
		port: env.intWithDefault(3000, "PORT"),
		baseUrl: env.required("BASE_URL"),
	}
}

// --- Database ---

export interface DatabaseConfig {
	uri: string
	name: string
	maxPoolSize: number
	minPoolSize: number
}

function getDatabaseConfig(): DatabaseConfig {
	return {
		uri: env.required("DATABASE_URI"),
		name: env("DATABASE_NAME", "DBNAME") ?? "simply-plural",
		maxPoolSize: env.intWithDefault(1000, "DB_MAX_POOLSIZE"),
		minPoolSize: env.intWithDefault(100, "DB_MIN_POOLSIZE"),
	}
}

// --- Auth ---

export interface AuthConfig {
	jwtKey: string
	jwtIssuer: string
	passwordKey: string
	passwordSeparator: string
	messagesKey: string
}

function getAuthConfig(): AuthConfig {
	return {
		jwtKey: env.required("JWT_KEY"),
		jwtIssuer: env("JWT_ISSUER") ?? "Apparyllis",
		passwordKey: env.required("PASSWORD_KEY"),
		passwordSeparator: env.required("PASSWORD_SEPARATOR", "PASSWORD_SEPERATOR"),
		messagesKey: env.required("MESSAGES_KEY"),
	}
}

// --- Branding ---

export interface BrandingConfig {
	name: string
	legalEntity: string | null
	url: string | null
	logoUrl: string | null
}

function getBrandingConfig(): BrandingConfig {
	return {
		name: env("BRANDING_NAME") ?? "Simply Plural",
		legalEntity: env("BRANDING_LEGAL_ENTITY"),
		url: env("BRANDING_URL"),
		logoUrl: env("BRANDING_LOGO_URL"),
	}
}

// --- Subscription ---

export interface SubscriptionConfig {
	name: string
	stripeKey: string
	stripePrices: string[]
	stripePlusProduct: string
	stripeWebhookSecret: string
	stripeMaxSubs: number | null
	plusRootUrl: string
}

function getSubscriptionConfig(): SubscriptionConfig | null {
	const stripeKey = env("STRIPE_KEY")
	if (!stripeKey) return null

	return {
		name: env("SUBSCRIPTION_NAME") ?? "Simply Plus",
		stripeKey,
		stripePrices: env.required("STRIPE_PRICES").split(","),
		stripePlusProduct: env.required("STRIPE_PLUS_PRODUCT"),
		stripeWebhookSecret: env.required("STRIPE_WEBHOOK_SECRET"),
		stripeMaxSubs: env.int("STRIPE_MAX_SUBS"),
		plusRootUrl: env.required("PLUS_ROOT_URL"),
	}
}

// --- Mail ---

export interface MailConfig {
	host: string
	port: number
	user: string
	password: string
	sender: string
}

function getMailConfig(): MailConfig | null {
	const host = env("MAIL_HOST", "MAILHOST")
	if (!host) return null

	return {
		host,
		port: env.intWithDefault(465, "MAIL_PORT", "MAILPORT"),
		user: env.required("MAIL_USER", "MAILUSER"),
		password: env.required("MAIL_PASSWORD", "MAILPASSWORD"),
		sender: env.required("MAIL_SENDER"),
	}
}

// --- Sentry ---

export interface SentryConfig {
	dsn: string
	sampleRate: number
}

function getSentryConfig(): SentryConfig | null {
	const dsn = env("SENTRY_DSN")
	if (!dsn) return null

	return {
		dsn,
		sampleRate: env.intWithDefault(0, "SENTRY_SAMPLE_RATE"),
	}
}

// --- Firebase ---

export interface FirebaseConfig {
	serviceAccount: string
	googleClientJwtAud: string
}

function getFirebaseConfig(): FirebaseConfig | null {
	const serviceAccount = env("FIREBASE_SERVICE_ACCOUNT", "SPGOOGLE")
	if (!serviceAccount) return null

	return {
		serviceAccount,
		googleClientJwtAud: env("GOOGLE_CLIENT_JWT_AUD") ?? "",
	}
}

// --- Google OAuth ---

export interface GoogleOAuthConfig {
	clientId: string
	clientAud: string
	clientIosId: string
	clientSecret: string
}

function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
	const clientId = env("GOOGLE_CLIENT_ID")
	if (!clientId) return null

	return {
		clientId,
		clientAud: env.required("GOOGLE_CLIENT_AUD"),
		clientIosId: env.required("GOOGLE_CLIENT_IOS_ID"),
		clientSecret: env.required("GOOGLE_CLIENT_SECRET"),
	}
}

// --- Apple OAuth ---

export interface AppleOAuthConfig {
	bundleIds: string[]
}

function getAppleOAuthConfig(): AppleOAuthConfig | null {
	const bundleIds = env("APPLE_BUNDLE_IDS")
	if (!bundleIds) return null

	return {
		bundleIds: bundleIds.split(",").map((id) => id.trim()),
	}
}

// --- Storage ---

export interface S3Config {
	bucket: string
	endpoint: string
	region: string
	accessKey: string
	accessSecret: string
}

export interface MinIOConfig {
	bucket: string
	endpoint: string
	port: number
	accessKey: string
	accessSecret: string
}

export interface LocalStorageConfig {
	rootDir: string
}

export type StorageTarget = "s3" | "local";

export interface StorageConfig {
	baseUrl: string
	legacyBaseUrl: string | null
	primaryTarget: StorageTarget
	s3: S3Config | null
	local: LocalStorageConfig | null
	legacyS3: S3Config | null
	legacyMinIO: MinIOConfig | null
}

function getS3Config(prefix: string): S3Config {
	return {
		bucket: env.required(`${prefix}_BUCKET`),
		endpoint: env.required(`${prefix}_ENDPOINT`),
		region: env.required(`${prefix}_REGION`),
		accessKey: env.required(`${prefix}_ACCESS_KEY`),
		accessSecret: env.required(`${prefix}_ACCESS_SECRET`),
	}
}

function getMinIOConfig(prefix: string): MinIOConfig {
	const port = env.intWithDefault(9000, `${prefix}_PORT`)
	if (port < 1024 || port > 65534) {
		throw new Error(`${prefix}_PORT must be between 1024 and 65534`)
	}

	return {
		bucket: env.required(`${prefix}_BUCKET`),
		endpoint: env.required(`${prefix}_ENDPOINT`),
		port,
		accessKey: env.required(`${prefix}_ACCESS_KEY`),
		accessSecret: env.required(`${prefix}_ACCESS_SECRET`),
	}
}

function getLocalStorageConfig(): LocalStorageConfig {
	return {
		rootDir: env.required("LOCAL_STORAGE_DIR"),
	}
}

function getStorageBaseUrl(primaryTarget: StorageTarget, serverBaseUrl: string): string {
	const storageBaseUrl = env("STORAGE_BASE_URL")

	if (storageBaseUrl) {
		return storageBaseUrl
	}

	if (primaryTarget === "s3") {
		throw new Error("Environment variable STORAGE_BASE_URL is required when using S3 storage")
	}

	return `${serverBaseUrl}/storage`
}

function getStorageConfig(serverBaseUrl: string): StorageConfig | null {
	if (!env.bool("WITH_STORAGE")) return null

	const primaryTarget = (env("PRIMARY_STORAGE_TARGET") ?? "local") as StorageTarget

	if (!["local", "s3"].includes(primaryTarget)) {
		throw new Error(`Invalid PRIMARY_STORAGE_TARGET="${primaryTarget}", must be either "s3" or "local"`)
	}

	return {
		baseUrl: getStorageBaseUrl(primaryTarget, serverBaseUrl),
		legacyBaseUrl: env("LEGACY_REPORT_BASE_URL"),
		primaryTarget,
		s3: primaryTarget === "s3" ? getS3Config("S3") : null,
		local: primaryTarget === "local" ? getLocalStorageConfig() : null,
		legacyS3: env.bool("WITH_LEGACY_S3") ? getS3Config("LEGACY_S3") : null,
		legacyMinIO: env.bool("WITH_LEGACY_MINIO") ? getMinIOConfig("LEGACY_MINIO") : null,
	}
}

// --- Logging ---

export interface LoggingConfig {
	noLogs: boolean
	logDir: string
	logPrefix: string
}

function getLoggingConfig(): LoggingConfig {
	return {
		noLogs: env.bool("NO_LOGS"),
		logDir: env("LOG_DIR") ?? "/var/log/simply-plural",
		logPrefix: env("LOG_PREFIX", "LOGPREFIX") ?? env("DATABASE_NAME", "DBNAME") ?? "",
	}
}

// --- Events ---

export interface EventsConfig {
	localEvents: boolean
	socketEmit: boolean
}

function getEventsConfig(): EventsConfig {
	return {
		localEvents: env.bool("ENABLE_LOCAL_EVENTS", "LOCALEVENTS"),
		socketEmit: env.bool("ENABLE_SOCKET_EMIT", "SOCKETEMIT"),
	}
}

// --- PluralKit ---

export interface PluralKitConfig {
	appHeader: string
}

function getPluralKitConfig(): PluralKitConfig | null {
	const appHeader = env("PLURALKIT_APP", "PLURALKITAPP")
	if (!appHeader) return null

	return { appHeader }
}

// --- Password Reset ---

function getPasswordResetPageUrl(baseUrl: string): string {
	return env("PASSWORD_RESET_PAGE_URL") ?? `${baseUrl}/auth/resetpassword.html`
}

// --- Top-level config ---

export interface AppConfig {
	server: ServerConfig
	database: DatabaseConfig
	auth: AuthConfig
	branding: BrandingConfig
	subscription: SubscriptionConfig | null
	mail: MailConfig | null
	sentry: SentryConfig | null
	firebase: FirebaseConfig | null
	googleOAuth: GoogleOAuthConfig | null
	appleOAuth: AppleOAuthConfig | null
	storage: StorageConfig | null
	logging: LoggingConfig
	events: EventsConfig
	pluralKit: PluralKitConfig | null
	passwordResetPageUrl: string
	development: boolean
	unitTest: boolean
}

function getConfig(): AppConfig {
	const server = getServerConfig()

	const config: AppConfig = {
		server,
		database: getDatabaseConfig(),
		auth: getAuthConfig(),
		branding: getBrandingConfig(),
		subscription: getSubscriptionConfig(),
		mail: getMailConfig(),
		sentry: getSentryConfig(),
		firebase: getFirebaseConfig(),
		googleOAuth: getGoogleOAuthConfig(),
		appleOAuth: getAppleOAuthConfig(),
		storage: getStorageConfig(server.baseUrl),
		logging: getLoggingConfig(),
		events: getEventsConfig(),
		pluralKit: getPluralKitConfig(),
		passwordResetPageUrl: getPasswordResetPageUrl(server.baseUrl),
		development: env.bool("DEVELOPMENT"),
		unitTest: env.bool("UNITTEST"),
	}

	return config
}

let _config: AppConfig | null = null

export function config(): AppConfig {
	// Config is lazy loaded, this is needed to control when they're loaded, which is crucial for tests,
	// where namely the database env vars are set programmatically.
	if (!_config) {
		_config = getConfig()
	}
    
	return _config
}