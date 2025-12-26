import "@dotenvx/dotenvx/config";
import { handleSigterm, setupRedis } from "../shared/utils.js";

handleSigterm(() => { });

// init
(() => {
    const redis = setupRedis("mapstack", msg => {

    });

    // redis.publish('photoncmd', 'start', (err, count) => {
    //     if (err) {
    //         logger.error('failed to publish to redis channel:', err);
    //         return
    //     }

    //     logger.info(`subscribed to ${count} channel(s). Waiting for commands`);
    // });
})();