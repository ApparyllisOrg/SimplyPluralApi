ARG NODE_VERSION=20.20.1
ARG WITH_PM2=false
ARG WITH_DOPPLER=false

# --- Build stage ---
FROM node:${NODE_VERSION} AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Base runtime stage ---
FROM node:${NODE_VERSION}-slim AS base

COPY --from=builder /build/dist /app/
COPY --from=builder /build/node_modules/ /app/node_modules/
COPY --from=builder /build/templates/ /app/templates/
COPY docker-entrypoint.sh /app/

RUN mkdir -p /var/log/simply-plural && \
    chown -R node:node /var/log/simply-plural && \
    chown -R node:node /app

WORKDIR /app
USER node
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

# --- PM2 stage (opt-in via --build-arg WITH_PM2=true) ---
FROM base AS pm2-true

USER root
RUN npm i -g pm2
USER node

FROM base AS pm2-false

# --- Doppler stage (opt-in via --build-arg WITH_DOPPLER=true) ---
FROM pm2-${WITH_PM2} AS doppler-true

USER root
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && \
    apt-get -y install doppler && \
    rm -rf /var/lib/apt/lists/*
USER node

# --- Final stage selector ---
FROM pm2-${WITH_PM2} AS doppler-false
FROM doppler-${WITH_DOPPLER}
