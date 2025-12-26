FROM node:24-alpine

WORKDIR /app

COPY docker/main/package*.json /app
COPY docker/main/src /app/src
COPY docker/shared /app/shared

RUN npm ci

EXPOSE 80
EXPOSE 8080

ENTRYPOINT ["node", "src/app.js"]