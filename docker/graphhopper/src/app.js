import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { constants } from 'fs';
import { access, readdir } from 'fs/promises';
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

    if (!(await isDataDirValid())) {
        logger.error("Download finished but data directory still empty, something is wrong.")
        process.exit(1);
    }

    //download is done, folder is ok, start
    graphhopper.start();
}

async function isDataDirValid() {
    const indexPath = graphhopper.CACHE_DIR;

    try {
        await access(indexPath, constants.F_OK);
        const files = await readdir(indexPath);

        if (!files.length > 0) {
            logger.info(`data directory ${indexPath} exists but is empty`);
            return false;
        }

        return true;
    } catch (error) {
        logger.info(`data directory ${indexPath} does not exist`);
    }

    return false;
}

async function initEnvMode() {
    //attempt to start
    if (await isDataDirValid()) {
        //TODO check if still same as COUNTRY, if not redownload (might need a meta file for that)
        graphhopper.start();
        return;
    }

    //data dir not set up, check if we can download
    if (process.env.REGION) {
        await graphhopper.downloadRegion(process.env.REGION);

        if (!(await isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        //download is done, folder is ok, start
        graphhopper.start();
        return;
    }

    logger.warn(".env REGION is not defined");
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
    if (await isDataDirValid()) {
        graphhopper.start();
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