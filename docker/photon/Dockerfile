FROM eclipse-temurin:21-jre-alpine

WORKDIR /photon

# === nodejs ===
RUN apk add --no-cache nodejs npm

COPY docker/photon/package*.json /photon
COPY docker/photon/src /photon/src
COPY docker/shared /photon/shared

RUN npm ci

# === photon ===
ARG PHOTON_VERSION=0.7.4
ADD https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-opensearch-${PHOTON_VERSION}.jar /photon/photon.jar

ENV PROTON_DATA_PATH="/photon/photon_data"

VOLUME /photon/photon_data

EXPOSE 2322

HEALTHCHECK --interval=30s --timeout=10s --start-period=240s --retries=3 CMD curl -f http://localhost:2322/status || exit 1

ENTRYPOINT ["node", "src/app.js"]