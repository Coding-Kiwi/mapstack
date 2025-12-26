FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# === nodejs ===
RUN apk add --no-cache nodejs npm

COPY docker/graphhopper/package*.json /app
COPY docker/graphhopper/src /app/src
COPY docker/shared /app/shared

RUN npm ci

# === graphhopper ===

ARG GRAPHHOPPER_VERSION=11.0
ADD https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/${GRAPHHOPPER_VERSION}/graphhopper-web-${GRAPHHOPPER_VERSION}.jar /app/graphhopper/graphhopper-web.jar

COPY docker/graphhopper/config.yml /app/graphhopper/

ENV GH_BINARY_PATH="/app/graphhopper/graphhopper-web.jar"
ENV GH_CONFIG_PATH="/app/graphhopper/config.yml"
ENV GH_DATA_PATH="/app/graphhopper_data"

VOLUME /app/graphhopper_data

EXPOSE 8989

HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD curl -fsS http://localhost:8989/health | grep -q '^OK$' || exit 1

ENTRYPOINT ["node", "src/app.js"]