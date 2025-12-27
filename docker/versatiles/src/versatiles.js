import logger from "fancy-log";
import { constants } from 'fs';
import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { downloadFile, launchProcess, stopProcess } from "../shared/utils.js";
import { updateDiskUsage, updateStatus } from "./status.js";

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

export async function downloadRegion(url, outpath, bbox = null) {
    if (!bbox) {
        await downloadFile(url, outpath);
    } else {
        await convert(url, outpath, bbox);
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