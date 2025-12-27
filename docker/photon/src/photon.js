import { readdir } from 'fs/promises';
import path from "node:path";
import { fileExists, launchProcess, stopProcess } from "../shared/utils.js";
import { updateStatus } from "./status.js";

export async function isDataDirValid() {
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

export async function start() {
    await updateStatus("starting");

    launchProcess("photon.jar", "java", ["-jar", "photon.jar"], {
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
    await stopProcess("photon.jar");
}