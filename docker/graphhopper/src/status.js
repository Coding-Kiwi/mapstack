import fastFolderSize from "fast-folder-size";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { formatBytes, getRedis } from "../shared/utils.js";

let redis;

export async function initStatus() {
    redis = getRedis();
}

async function getDiskUsage() {
    try {
        await access(process.env.GH_DATA_PATH, constants.F_OK);
    } catch (error) {
        return null;
    }

    const fastFolderSizeAsync = promisify(fastFolderSize);
    const bytes = await fastFolderSizeAsync(process.env.GH_DATA_PATH);

    return formatBytes(bytes);
}

export async function updateDiskUsage() {
    redis.set("graphhopper.disk_usage", await getDiskUsage());
}

export async function updateStatus(status) {
    redis.set("graphhopper.status", status);
}