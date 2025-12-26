FROM node:24-alpine

# for downloading and extracting mapdata
RUN apk add --no-cache bzip2 wget curl

WORKDIR /app

COPY package*.json /app
COPY src /app/src

RUN npm ci

VOLUME /data/photon
VOLUME /data/versatiles
VOLUME /data/graphhopper

EXPOSE 80
EXPOSE 8080

ENTRYPOINT ["node", "src/app.js"]