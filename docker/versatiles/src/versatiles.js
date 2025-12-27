import logger from "fancy-log";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { downloadFile, fileExists, launchProcess, setExpectedDeployment, stopProcess } from "../shared/utils.js";
import { updateDiskUsage, updateStatus } from "./status.js";

export async function getSources() {
    if (!(await fileExists(process.env.VT_DATA_PATH))) {
        logger.info(`data directory ${process.env.VT_DATA_PATH} does not exist`);
        return [];
    }

    const files = await readdir(process.env.VT_DATA_PATH);
    return files
        .filter(f => f.endsWith(".versatiles"))
        .map(f => resolve(process.env.VT_DATA_PATH, f));
}

function convert(url, outpath, bbox = null) {
    return new Promise((resolve, reject) => {
        logger.info(`Downloading from "${url}" to "${outpath}" with bbox ${bbox}`);

        let convertProcess = launchProcess("versatiles-convert", process.env.VT_BINARY_PATH, [
            'convert',
            '--bbox-border', '3',
            '--bbox', bbox,
            url,
            outpath
        ]);

        convertProcess.on('exit', (code, signal) => {
            convertProcess = null;

            if (code === 0) {
                resolve();
            } else {
                reject();
            }
        });
    });
}

export async function isDataDirValid() {
    const sources = await getSources();
    return sources.length > 0;
}

export async function downloadRegion(bbox = null) {
    await setExpectedDeployment("");

    if (!bbox) {
        await downloadFile(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles");
        await downloadFile(process.env.DOWNLOAD_URL + "/hillshade-vectors.versatiles", process.env.VT_DATA_PATH + "/hillshade-vectors.versatiles");
        await downloadFile(process.env.DOWNLOAD_URL + "/landcover-vectors.versatiles", process.env.VT_DATA_PATH + "/landcover-vectors.versatiles");
        await setExpectedDeployment("planet");
    } else {
        await convert(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles", bbox);
        await convert(process.env.DOWNLOAD_URL + "/hillshade-vectors.versatiles", process.env.VT_DATA_PATH + "/hillshade-vectors.versatiles", bbox);
        await convert(process.env.DOWNLOAD_URL + "/landcover-vectors.versatiles", process.env.VT_DATA_PATH + "/landcover-vectors.versatiles", bbox);
        await setExpectedDeployment(bbox);
    }

    if (!(await isDataDirValid())) {
        logger.error("Download finished but data directory still empty, something is wrong.")
        process.exit(1);
    }

    await updateDiskUsage();
}

export async function start() {
    await updateStatus("starting");

    const sources = await getSources();

    logger.info(`Launching with sources ${sources.join(",")}`);

    launchProcess("versatiles", process.env.VT_BINARY_PATH, [
        "serve",
        "--config", process.env.VT_CONFIG_PATH,
        ...sources
    ], {
        onLog(line) {
            if (line.includes(process.env.LOG_READY_MATCH)) {
                updateStatus("online");
            }
        },
        onExit() {
            updateStatus("offline");
        }
    });
}

export async function stop() {
    await stopProcess("versatiles");
}