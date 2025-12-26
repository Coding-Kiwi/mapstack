import "@dotenvx/dotenvx/config";
import fastifyProxy from "@fastify/http-proxy";
import logger from "fancy-log";
import fastify from "fastify";
import { getRedis, handleSigterm, setupRedis } from "../shared/utils.js";
import { setupCountryList } from "./countrylist.js";

handleSigterm(() => { });

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

        admin.get("/admin/countries", async (req, res) => {
            const countries = await setupCountryList(redis);
            return res.send(countries);
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