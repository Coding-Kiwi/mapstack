import logger from "fancy-log";
import fastFolderSize from "fast-folder-size";
import { promisify } from "node:util";
import { formatBytes, getRedis, fileExists } from "../shared/utils.js";

let redis;

export async function initStatus() {
    redis = getRedis();
}

async function getDiskUsage() {
    if (!(await fileExists(process.env.GH_DATA_PATH))) return null;

    const fastFolderSizeAsync = promisify(fastFolderSize);
    const bytes = await fastFolderSizeAsync(process.env.GH_DATA_PATH);

    return formatBytes(bytes);
}

export async function updateDiskUsage() {
    redis.set("graphhopper.disk_usage", await getDiskUsage());
}

export async function updateStatus(status) {
    logger.info("status " + status)
    redis.set("graphhopper.status", status);
}