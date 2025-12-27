FROM node:24-alpine

WORKDIR /app

COPY docker/versatiles/package*.json /app
COPY docker/versatiles/src /app/src
COPY docker/versatiles/.env /app/.env
COPY docker/shared /app/shared

RUN npm ci

# === versatiles ===

ARG VERSATILES_VERSION=v2.3.1
ENV VERSATILES_DOWNLOAD_URL="https://github.com/versatiles-org/versatiles-rs/releases/download/${VERSATILES_VERSION}/versatiles-linux-musl-x86_64.tar.gz"

RUN apk add --no-cache curl
RUN curl --retry 3 -sL "$VERSATILES_DOWNLOAD_URL" | tar x -zf - versatiles
RUN chmod +x versatiles

ENV VT_BINARY_PATH="/app/versatiles"
ENV VT_CONFIG_PATH="/app/config.yaml"
ENV VT_DATA_PATH="/app/versatiles_data"

COPY docker/versatiles/config.yaml /app/config.yaml

VOLUME /app/versatiles_data

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD curl -f http://localhost:8080/status || exit 1

EXPOSE 8080

ENTRYPOINT ["node", "src/app.js"]