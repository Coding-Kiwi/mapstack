import "@dotenvx/dotenvx/config";
import fastifyProxy from "@fastify/http-proxy";
import fastifyStatic from '@fastify/static';
import logger from "fancy-log";
import fastify from "fastify";
import got from "got";
import path from "node:path";
import { getRedis, handleSigterm, setupRedis } from "../shared/utils.js";
import { setupCountryList } from "./countrylist.js";

handleSigterm(() => { });

//TODO move to utils
const delay = ms => new Promise(res => setTimeout(res, ms));

// init
(async () => {
    const redisPubSub = setupRedis("mapstack", msg => {

    });

    const redis = getRedis();

    const gateway = fastify();

    gateway.register(fastifyProxy, {
        upstream: process.env.PHOTON_URL,
        prefix: "/geocode"
    });

    gateway.register(fastifyProxy, {
        upstream: process.env.VERSATILES_URL,
        prefix: "/tiles",
        rewritePrefix: "/tiles"
    });

    gateway.register(fastifyProxy, {
        upstream: process.env.GRAPHHOPPER_URL,
        prefix: "/routing",
        preValidation: async (request, reply) => {
            if (request.url.startsWith('/routing/maps')) {
                return reply.code(400).send({ message: 'Graphhopper web UI is disabled' });
            }
        }
    });

    gateway.listen({
        port: process.env.GATEWAY_PORT,
        host: process.env.GATEWAY_HOST
    }, function (err, address) {
        if (err) {
            fastify.log.error(err)
            process.exit(1)
        }

        logger.info(`Server is now listening on ${process.env.GATEWAY_HOST}:${process.env.GATEWAY_PORT}`);
        logger.info("- proton available under /geocode/api");
        logger.info("- versatiles available under /tiles/{z}/{x}/{y}");
        logger.info("- graphhopper available under /routing/route");
    })

    if (process.env.DISABLE_ADMIN !== "true") {
        const admin = fastify();

        await admin.register(fastifyStatic, {
            root: path.join(import.meta.dirname, 'client', 'dist'),
            prefix: "/admin",
            prefixAvoidTrailingSlash: true
        });

        admin.get("/admin/countries", async (req, res) => {
            const countries = await setupCountryList(redis);
            return res.send(countries);
        })

        admin.get("/admin/status", async (req, res) => {
            let versatiles_status = "offline";
            try {
                versatiles_status = await got(process.env.VERSATILES_URL + "/status", {
                    timeout: {
                        request: 100
                    },
                    retry: { limit: 0 }
                }).text();

                versatiles_status = versatiles_status.includes("ready") ? "online" : "starting";
            } catch (error) {
                if (error.code === "ETIMEDOUT") versatiles_status = "starting";
            }

            let photon_status = "offline";
            try {
                photon_status = await got(process.env.PHOTON_URL + "/status", {
                    timeout: {
                        request: 100
                    },
                    retry: { limit: 0 }
                }).json();

                photon_status = photon_status.status === "Ok" ? "online" : "offline";
            } catch (error) {
                if (error.code === "ETIMEDOUT") photon_status = "starting";
            }

            let hopper_status = "offline";

            try {
                hopper_status = await got(process.env.GRAPHHOPPER_URL + "/health", {
                    timeout: {
                        request: 100
                    },
                    retry: { limit: 0 }
                }).text();

                hopper_status = hopper_status === "OK" ? "online" : "starting"
            } catch (error) {
                if (error.code === "ETIMEDOUT") hopper_status = "starting";
            }

            return res.send({
                photon: {
                    status: photon_status,
                    disk_usage: await redis.get("photon.disk_usage")
                },
                versatiles: {
                    status: versatiles_status,
                    disk_usage: await redis.get("versatiles.disk_usage")
                },
                graphhopper: {
                    status: hopper_status,
                    disk_usage: await redis.get("graphhopper.disk_usage")
                }
            });
        })

        admin.listen({
            port: process.env.ADMIN_PORT,
            host: process.env.ADMIN_HOST
        }, function (err, address) {
            if (err) {
                fastify.log.error(err)
                process.exit(1)
            }

            logger.info(`Admin Server is now listening on ${process.env.ADMIN_HOST}:${process.env.ADMIN_PORT}`);
        })
    }

    // redis.publish('photoncmd', 'start', (err, count) => {
    //     if (err) {
    //         logger.error('failed to publish to redis channel:', err);
    //         return
    //     }

    //     logger.info(`subscribed to ${count} channel(s). Waiting for commands`);
    // });
})();