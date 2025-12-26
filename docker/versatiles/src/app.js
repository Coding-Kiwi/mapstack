import "@dotenvx/dotenvx/config";
import logger from "fancy-log";
import { handleSigterm, setupRedis, stopAllProcesses } from "../shared/utils.js";
import * as versatiles from "./versatiles.js";

handleSigterm(() => {
    stopAllProcesses();
});

async function switchBBOX(bbox) {
    if (process.env.MANAGED !== "true") {
        logger.error("Switching bbox dynamically is only supported in MANAGED mode");
        return;
    }

    versatiles.stop();

    await versatiles.convert(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles", bbox);

    if (!(await isDataDirValid())) {
        logger.error("Download finished but data directory still empty, something is wrong.")
        process.exit(1);
    }

    //download is done, folder is ok, start
    versatiles.start();
}

async function isDataDirValid() {
    const sources = await versatiles.getSources();
    return sources.length > 0;
}

async function initEnvMode() {
    //attempt to start
    if (await isDataDirValid()) {
        versatiles.start();
        return;
    }

    //data dir not set up, check if we can download
    if (process.env.BBOX) {
        await versatiles.convert(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles", process.env.BBOX);

        if (!(await isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        //download is done, folder is ok, start
        versatiles.start();
        return;
    }

    logger.warn(".env BBOX is not defined");
}

async function initManagedMode() {
    setupRedis("mapstack", msg => {
        if (msg.cmd === "versatiles.set-bbox") {
            switchBBOX(msg.bbox);
            return;
        }
    });

    //attempt to start
    if (await isDataDirValid()) {
        versatiles.start();
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