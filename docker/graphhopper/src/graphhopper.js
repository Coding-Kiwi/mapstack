import logger from "fancy-log";
import { mkdir } from "fs/promises";
import path from "path";
import { downloadFile, launchProcess, stopProcess } from "../shared/utils.js";
import { updateDiskUsage } from "./status.js";

export const PBF_FILE = path.join(process.env.GH_DATA_PATH, "input.osm.pbf");
export const CACHE_DIR = path.join(process.env.GH_DATA_PATH, "cache");

export function importPbf() {
    return new Promise((resolve, reject) => {
        logger.info(`Importing "${PBF_FILE}" using target cache "${CACHE_DIR}"`);

        let importProcess = launchProcess("graphhopper-import", "java", [
            '-Xmx4g', '-Xms4g',
            '-Ddw.graphhopper.datareader.file=' + PBF_FILE,
            '-Ddw.graphhopper.graph.location=' + CACHE_DIR,
            '-jar', process.env.GH_BINARY_PATH,
            'import', process.env.GH_CONFIG_PATH
        ]);

        importProcess.on('exit', (code, signal) => {
            importProcess = null;

            if (code === 0) {
                resolve();
            } else {
                reject();
            }
        });
    });
}

export async function downloadRegion(regionName) {
    const parsedUrl = process.env.REGION_DOWNLOAD_URL.replace(/<REGION>/g, regionName);
    logger.info(`Downloading region "${regionName}" from "${parsedUrl}"`);

    await mkdir(CACHE_DIR, { recursive: true });

    await downloadFile(parsedUrl, PBF_FILE);
    await importPbf();
    await updateDiskUsage();
}

export async function start() {
    logger.info(`Launching`);

    launchProcess("graphhopper", "java", [
        '-Xmx2g',
        `-Ddw.graphhopper.graph.location=${CACHE_DIR}`,
        '-jar', process.env.GH_BINARY_PATH,
        'server', process.env.GH_CONFIG_PATH
    ]);
}

export async function stop() {
    stopProcess("graphhopper");
}