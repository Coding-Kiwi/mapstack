import logger from "fancy-log";
import { constants } from 'fs';
import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { launchProcess, stopProcess } from "../shared/utils.js";

export async function getSources() {
    try {
        await access(process.env.VT_DATA_PATH, constants.F_OK);
    } catch (error) {
        logger.info(`data directory ${process.env.VT_DATA_PATH} does not exist`);
        return [];
    }

    const files = await readdir(process.env.VT_DATA_PATH);
    return files
        .filter(f => f.endsWith(".versatiles"))
        .map(f => resolve(process.env.VT_DATA_PATH, f));
}

export function convert(url, outpath, bbox) {
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

export async function start() {
    const sources = await getSources();

    logger.info(`Launching with sources ${sources.join(",")}`);

    launchProcess("versatiles", process.env.VT_BINARY_PATH, [
        "serve",
        "--config", process.env.VT_CONFIG_PATH,
        ...sources
    ]);
}

export async function stop() {
    stopProcess("versatiles");
}