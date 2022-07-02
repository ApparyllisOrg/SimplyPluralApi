FROM alpine:latest as builder

RUN apk add nodejs-current npm

WORKDIR /build
COPY . /build/
RUN npm i
RUN npm run build

FROM alpine:latest

RUN apk add nodejs-current

COPY --from=builder /build/dist /app/
COPY --from=builder /build/node_modules/ /app/node_modules/

WORKDIR /app

EXPOSE 8443

ENTRYPOINT [ "/usr/bin/node", "index.js" ]
