import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { readdir } from 'fs/promises';
import path from "path";
import { fileExists, handleSigterm, setupRedis, stopAllProcesses } from "../shared/utils.js";
import { downloadCountry } from "./downloader.js";
import * as photon from "./photon.js";
import { initStatus, updateDiskUsage, updateStatus } from "./status.js";

handleSigterm(() => {
    stopAllProcesses();
    updateStatus("offline");
});

async function switchCountry(country) {
    await photon.stop();

    await updateStatus("starting");

    await downloadCountry(country);

    if (!(await isDataDirValid())) {
        logger.error("Download finished but data directory still empty, something is wrong.")
        process.exit(1);
    }

    //download is done, folder is ok, start
    photon.start();
}

async function isDataDirValid() {
    const indexPath = path.resolve(process.env.PROTON_DATA_PATH, "node_1");

    if (!(await fileExists(indexPath))) return false;

    try {
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
        photon.start();
        return;
    }

    //data dir not set up, check if we can download
    if (process.env.COUNTRY) {
        await downloadCountry(process.env.COUNTRY);

        if (!(await isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        //download is done, folder is ok, start
        photon.start();
        return;
    }

    logger.warn(".env COUNTRY is not defined");
}

async function initManagedMode() {
    await initStatus();
    await updateDiskUsage();

    setupRedis("mapstack", msg => {
        if (msg.cmd === "photon.set-country") {
            switchCountry(msg.country);
            return;
        }
    });

    //attempt to start
    if (await isDataDirValid()) {
        photon.start();
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