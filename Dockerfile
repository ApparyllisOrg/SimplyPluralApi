ARG NODE_VERSION=20.20.1

FROM node:${NODE_VERSION} AS builder

WORKDIR /build
COPY . /build/
RUN npm i
RUN npm run build

FROM node:${NODE_VERSION}

# Install Doppler CLI
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && \
    apt-get -y install doppler

COPY --from=builder /build/dist /app/
COPY --from=builder /build/node_modules/ /app/node_modules/
COPY --from=builder /build/templates/ /app/templates/

RUN npm i -g pm2
RUN mkdir -p /var/log/simply-plural
RUN chown -R node:node /var/log/simply-plural
RUN chown node:node /app

WORKDIR /app
USER node

EXPOSE 3000

CMD ["doppler", "run", "--", "pm2-runtime", "index.js", "-i", "max"]
