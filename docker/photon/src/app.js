import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { handleSigterm, setupRedis, stopAllProcesses } from "../shared/utils.js";
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
    await photon.start();
}

async function initEnvMode() {
    //attempt to start
    if (await photon.isDataDirValid()) {
        //we have a valid data dir

        if (process.env.COUNTRY) {
            //COUNTRY is configured, check deployment
            if (await isExpectedDeployment(process.env.COUNTRY)) {
                logger.info(`Expected deployment ${process.env.COUNTRY} OK`);
            } else {
                logger.info(`Current deployment is not ${process.env.COUNTRY}, update`);

                await downloadCountry(process.env.COUNTRY);
            }
        }

        photon.start();
        return;
    }

    if (!process.env.COUNTRY) {
        logger.error(".env COUNTRY is not defined and not in MANAGED mode");
        process.exit(1);
    }

    //data dir not set up, check if we can download
    await downloadCountry(process.env.COUNTRY);

    //download is done, folder is ok, start
    photon.start();
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
    if (await photon.isDataDirValid()) {
        await photon.start();
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