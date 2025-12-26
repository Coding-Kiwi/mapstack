import "@dotenvx/dotenvx/config";
import { getRedis, handleSigterm, setupRedis } from "../shared/utils.js";
import { setupCountryList } from "./countrylist.js";

handleSigterm(() => { });

// init
(async () => {
    const redisPubSub = setupRedis("mapstack", msg => {

    });

    const redis = getRedis();

    const countries = await setupCountryList(redis);


    // redis.publish('photoncmd', 'start', (err, count) => {
    //     if (err) {
    //         logger.error('failed to publish to redis channel:', err);
    //         return
    //     }

    //     logger.info(`subscribed to ${count} channel(s). Waiting for commands`);
    // });
})();