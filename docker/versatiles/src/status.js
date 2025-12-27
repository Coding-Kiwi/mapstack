import logger from "fancy-log";
import fastFolderSize from "fast-folder-size";
import { promisify } from "node:util";
import { fileExists, formatBytes, getRedis } from "../shared/utils.js";

let redis;

export async function initStatus() {
    redis = getRedis();
}

async function getDiskUsage() {
    if (!(await fileExists(process.env.VT_DATA_PATH))) return null;

    const fastFolderSizeAsync = promisify(fastFolderSize);
    const bytes = await fastFolderSizeAsync(process.env.VT_DATA_PATH);

    return formatBytes(bytes);
}

export async function updateDiskUsage() {
    if (!redis) return;
    redis.set("versatiles.disk_usage", await getDiskUsage());
}

export async function updateStatus(status) {
    if (!redis) return;

    logger.info("status " + status)
    redis.set("versatiles.status", status);
}