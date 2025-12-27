import "@dotenvx/dotenvx/config";
import fastifyProxy from "@fastify/http-proxy";
import fastifyStatic from '@fastify/static';
import logger from "fancy-log";
import fastify from "fastify";
import path from "node:path";
import { getRedis, handleSigterm } from "../shared/utils.js";
import { setupCountryList } from "./countrylist.js";

handleSigterm(() => { });

// init
(async () => {
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
            return res.send({
                photon: {
                    status: (await redis.get("photon.status")) ?? "offline",
                    disk_usage: await redis.get("photon.disk_usage")
                },
                versatiles: {
                    status: (await redis.get("versatiles.status")) ?? "offline",
                    disk_usage: await redis.get("versatiles.disk_usage")
                },
                graphhopper: {
                    status: (await redis.get("graphhopper.status")) ?? "offline",
                    disk_usage: await redis.get("graphhopper.disk_usage")
                }
            });
        })

        admin.post("/admin/deploy", async (req, res) => {
            logger.info(`Deploying country ${req.body.country.name}`);

            await redis.publish("mapstack", JSON.stringify({
                cmd: "versatiles.set-bbox",
                bbox: req.body.country.bbox.join(",")
            }));

            await redis.publish("mapstack", JSON.stringify({
                cmd: "photon.set-country",
                country: req.body.country.code
            }));

            await redis.publish("mapstack", JSON.stringify({
                cmd: "graphhopper.set-region",
                region: req.body.country.region
            }));

            res.status(204).send();
        });

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