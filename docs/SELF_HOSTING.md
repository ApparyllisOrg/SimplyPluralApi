# Self-hosting

## Quick Start

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in the required values
3. Run:

```bash
docker compose up -d
```

The API will be available at `http://localhost:3000`.

> **Note:** MongoDB must run as a replica set for WebSocket change streams to work. The included `compose.yml` handles this automatically.

### Minimal Setup

With only the required env vars set, the API starts with:

- No email verification (users are auto-verified)
- No avatar/report storage
- No Sentry error tracking
- No Stripe subscriptions
- No Firebase/Google/Apple OAuth

You can enable features by configuring them in the `.env` file.

## Environment Variables

See `.env.example` for a ready-to-use template. All variables are documented below.

### Required

| Variable             | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| `BASE_URL`           | Public URL of the API (e.g. `http://localhost:3000`)                       |
| `DATABASE_URI`       | MongoDB connection URI (must include `?replicaSet=...` for change streams) |
| `DATABASE_NAME`      | Database name (default: `simply-plural`)                                   |
| `JWT_KEY`            | Secret key for signing JWTs (base64-encoded)                               |
| `JWT_ISSUER`         | Issuer claim in JWTs (default: `Apparyllis`)                               |
| `PASSWORD_KEY`       | Secret key for password hashing                                            |
| `PASSWORD_SEPARATOR` | Separator used in password hashing                                         |
| `MESSAGES_KEY`       | Secret key for message encryption                                          |

### Server

| Variable      | Default                  | Description                                                                           |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `PORT`        | `3000`                   | Port to listen on                                                                     |
| `DEVELOPMENT` | `false`                  | Enable development mode (CORS, verbose logging)                                       |
| `NO_LOGS`     | `false`                  | Disable file logging                                                                  |
| `LOG_DIR`     | `/var/log/simply-plural` | Directory for log files                                                               |
| `LOG_PREFIX`  | -                        | Prefix for log filenames                                                              |
| `CORS_ORIGIN` | -                        | Comma separated list of allowed cors origin. Set to `false` to disable CORS handling. |

> **Note:** If `DEVELOPMENT=true`, CORS always gets enabled, regardless of `CORS_ORIGIN`'s value. If `CORS_ORIGIN` is set to `false`, it will fall back to `*`.

### Events

| Variable              | Default | Description                                           |
| --------------------- | ------- | ----------------------------------------------------- |
| `ENABLE_LOCAL_EVENTS` | `false` | Run event controller (reminders, front notifications) |
| `ENABLE_SOCKET_EMIT`  | `false` | Emit MongoDB changes over WebSocket                   |

### Mail (optional)

Set `MAIL_HOST` to enable email. When disabled, users are auto-verified on registration.

| Variable        | Default | Description             |
| --------------- | ------- | ----------------------- |
| `MAIL_HOST`     | -       | SMTP server hostname    |
| `MAIL_PORT`     | `465`   | SMTP server port        |
| `MAIL_USER`     | -       | SMTP username           |
| `MAIL_PASSWORD` | -       | SMTP password           |
| `MAIL_SENDER`   | -       | From address for emails |

### Storage (optional)

Set `WITH_STORAGE=true` to enable avatar uploads and report generation.

| Variable                   | Description                              |
| -------------------------- | ---------------------------------------- |
| `WITH_STORAGE`             | Set to `true` to enable                  |
| `STORAGE_BASE_URL`         | Public URL where stored files are served |
| `PRIMARY_S3_BUCKET`        | S3 bucket name                           |
| `PRIMARY_S3_ENDPOINT`      | S3 endpoint URL                          |
| `PRIMARY_S3_REGION`        | S3 region                                |
| `PRIMARY_S3_ACCESS_KEY`    | S3 access key                            |
| `PRIMARY_S3_ACCESS_SECRET` | S3 secret key                            |

Legacy storage backends (`LEGACY_S3_*`, `LEGACY_MINIO_*`) are available for migration from older setups. Enable with `WITH_LEGACY_S3=true` or `WITH_LEGACY_MINIO=true`.

#### Legacy S3

| Variable                  | Description          |
| ------------------------- | -------------------- |
| `WITH_LEGACY_S3`          | Set `true` to enable |
| `LEGACY_S3_BUCKET`        | S3 bucket name       |
| `LEGACY_S3_ENDPOINT`      | S3 endpoint URL      |
| `LEGACY_S3_REGION`        | S3 region            |
| `LEGACY_S3_ACCESS_KEY`    | S3 access key        |
| `LEGACY_S3_ACCESS_SECRET` | S3 secret key        |

#### Legacy MinIO

| Variable                     | Description                         |
| ---------------------------- | ----------------------------------- |
| `WITH_LEGACY_MINIO`          | Set `true` to enable                |
| `LEGACY_MINIO_BUCKET`        | MinIO bucket name                   |
| `LEGACY_MINIO_ENDPOINT`      | MinIO server hostname               |
| `LEGACY_MINIO_PORT`          | MinIO server port (default: `9000`) |
| `LEGACY_MINIO_ACCESS_KEY`    | MinIO access key                    |
| `LEGACY_MINIO_ACCESS_SECRET` | MinIO secret key                    |

### Firebase (optional)

Set `FIREBASE_SERVICE_ACCOUNT` to enable Firebase auth (for migrating existing Firebase users).

| Variable                   | Description                                 |
| -------------------------- | ------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (as a string) |
| `GOOGLE_CLIENT_JWT_AUD`    | Expected audience for Google JWTs           |

### OAuth (optional)

#### Google

Set `GOOGLE_CLIENT_ID` to enable Google OAuth.

| Variable               | Description                |
| ---------------------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID     |
| `GOOGLE_CLIENT_AUD`    | Google OAuth audience      |
| `GOOGLE_CLIENT_IOS_ID` | Google OAuth iOS client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

#### Apple

Set `APPLE_BUNDLE_IDS` to enable Apple Sign-In.

| Variable           | Description                              |
| ------------------ | ---------------------------------------- |
| `APPLE_BUNDLE_IDS` | Comma-separated list of Apple bundle IDs |

### Sentry (optional)

Set `SENTRY_DSN` to enable error tracking.

| Variable             | Default | Description                                        |
| -------------------- | ------- | -------------------------------------------------- |
| `SENTRY_DSN`         | -       | Sentry DSN                                         |
| `SENTRY_SAMPLE_RATE` | `0`     | Sentry trace sample rate (integer, divided by 100) |

### Stripe Subscriptions (optional)

Set `STRIPE_KEY` to enable paid subscriptions.

| Variable                | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `STRIPE_KEY`            | Stripe API key                                             |
| `STRIPE_PRICES`         | Comma-separated Stripe price IDs                           |
| `STRIPE_PLUS_PRODUCT`   | Stripe product ID for the premium tier                     |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret                              |
| `STRIPE_MAX_SUBS`       | Maximum subscriptions (optional)                           |
| `PLUS_ROOT_URL`         | URL for the subscription management page                   |
| `SUBSCRIPTION_NAME`     | Display name for the subscription (default: `Simply Plus`) |

### Branding (optional)

| Variable                | Default         | Description                           |
| ----------------------- | --------------- | ------------------------------------- |
| `BRANDING_NAME`         | `Simply Plural` | App name used in emails and templates |
| `BRANDING_URL`          | -               | URL for the brand/organization        |
| `BRANDING_LOGO_URL`     | -               | URL to a logo image for emails        |
| `BRANDING_LEGAL_ENTITY` | -               | Legal entity name for email footers   |

### PluralKit (optional)

| Variable        | Description                  |
| --------------- | ---------------------------- |
| `PLURALKIT_APP` | PluralKit-granted app header |

### Other

| Variable                  | Default                               | Description                     |
| ------------------------- | ------------------------------------- | ------------------------------- |
| `PASSWORD_RESET_PAGE_URL` | `${BASE_URL}/auth/resetpassword.html` | URL for the password reset page |
