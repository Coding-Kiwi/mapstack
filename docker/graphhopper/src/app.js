import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { handleSigterm, setupRedis, stopAllProcesses } from "../shared/utils.js";
import * as graphhopper from "./graphhopper.js";
import { initStatus, updateDiskUsage, updateStatus } from "./status.js";

handleSigterm(() => {
    stopAllProcesses();
    updateStatus("offline");
});

async function switchRegion(region) {
    await graphhopper.stop();
    await updateStatus("starting");
    await graphhopper.downloadRegion(region);
    await graphhopper.start();
}

async function initEnvMode() {
    //attempt to start
    if (await graphhopper.isDataDirValid()) {
        //we have a valid data dir

        if (process.env.REGION) {
            //REGION is configured, check deployment
            if (await isExpectedDeployment(process.env.REGION)) {
                logger.info(`Expected deployment ${process.env.REGION} OK`);
            } else {
                logger.info(`Current deployment is not ${process.env.REGION}, update`);

                await graphhopper.downloadRegion(process.env.REGION);
            }
        }

        graphhopper.start();
        return;
    }

    if (!process.env.REGION) {
        logger.error(".env REGION is not defined and not in MANAGED mode");
        process.exit(1);
    }


    //data dir not set up, check if we can download
    await graphhopper.downloadRegion(process.env.REGION);

    //download is done, folder is ok, start
    graphhopper.start();
}

async function initManagedMode() {
    await initStatus();
    await updateDiskUsage();

    setupRedis("mapstack", msg => {
        if (msg.cmd === "graphhopper.set-region") {
            switchRegion(msg.region);
            return;
        }
    });

    //attempt to start
    if (await graphhopper.isDataDirValid()) {
        await graphhopper.start();
    }
}

// init
(() => {
    if (process.env.MANAGED === "true") {
        logger.info("REDIS_URL is " + process.env.REDIS_URL + ", running in managed mode");
        initManagedMode();
    } else {
        logger.info("Not managed, running in .env mode");
        initEnvMode();
    }
})();