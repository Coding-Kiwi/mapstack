import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { handleSigterm, isExpectedDeployment, setupRedis, stopAllProcesses } from "../shared/utils.js";
import { initStatus, updateDiskUsage, updateStatus } from "./status.js";
import * as versatiles from "./versatiles.js";

handleSigterm(() => {
    stopAllProcesses();
    updateStatus("offline");
});

async function switchBBOX(bbox) {
    await versatiles.stop();
    await updateStatus("starting");
    await versatiles.downloadRegion(bbox);
    await versatiles.start();
}

async function initEnvMode() {
    //attempt to start
    if (await versatiles.isDataDirValid()) {
        //we have a valid data dir

        if (process.env.BBOX) {
            //BBOX is configured, check deployment
            if (await isExpectedDeployment(process.env.BBOX)) {
                logger.info(`Expected deployment ${process.env.BBOX} OK`);
            } else {
                logger.info(`Current deployment is not ${process.env.BBOX}, update`);

                await versatiles.downloadRegion(process.env.BBOX);
            }
        }

        versatiles.start();
        return;
    }

    if (!process.env.BBOX) {
        logger.error(".env BBOX is not defined and not in MANAGED mode");
        process.exit(1);
    }

    //data dir not set up, check if we can download
    await versatiles.downloadRegion(process.env.BBOX);

    //download is done, folder is ok, start
    versatiles.start();
    return;
}

async function initManagedMode() {
    await initStatus();
    await updateDiskUsage();

    setupRedis("mapstack", msg => {
        if (msg.cmd === "versatiles.set-bbox") {
            switchBBOX(msg.bbox);
            return;
        }
    });

    //attempt to start
    if (await versatiles.isDataDirValid()) {
        await versatiles.start();
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