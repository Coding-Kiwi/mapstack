FROM node:24-alpine

WORKDIR /app

COPY docker/main/package*.json /app
COPY docker/main/src /app/src
COPY docker/shared /app/shared

RUN npm ci

ENV GATEWAY_PORT=80
ENV GATEWAY_HOST=0.0.0.0

ENV ADMIN_PORT=8080
ENV ADMIN_HOST=0.0.0.0

EXPOSE 80
EXPOSE 8080

ENTRYPOINT ["node", "src/app.js"]