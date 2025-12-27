FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# === nodejs ===
RUN apk add --no-cache nodejs npm

COPY docker/photon/package*.json /app
COPY docker/photon/src /app/src
COPY docker/photon/.env /app/.env
COPY docker/shared /app/shared

RUN npm ci

# === photon ===
ARG PHOTON_VERSION=0.7.4
ADD https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-opensearch-${PHOTON_VERSION}.jar /app/photon.jar

ENV PROTON_DATA_PATH="/app/photon_data"

VOLUME /app/photon_data

EXPOSE 2322

HEALTHCHECK --interval=30s --timeout=10s --start-period=240s --retries=3 CMD curl -f http://localhost:2322/status || exit 1

ENTRYPOINT ["node", "src/app.js"]