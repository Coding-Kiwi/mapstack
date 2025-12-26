import logger from "fancy-log";
import fs from "fs";
import { mkdir, rm } from "fs/promises";
import https from "https";
import path from "path";
import { formatBytes, launchProcess, stopProcess } from "../shared/utils.js";

export const PBF_FILE = path.join(process.env.GH_DATA_PATH, "input.osm.pbf");
export const CACHE_DIR = path.join(process.env.GH_DATA_PATH, "cache");

async function downloadPbfFile(url) {
    await rm(PBF_FILE, { force: true });

    return new Promise((resolve, reject) => {
        function get(url) {
            https.get(url, (res) => {
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    return get(redirectUrl);
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to download, status code: ${res.statusCode}`));
                    res.resume();
                    return;
                }

                const totalSize = parseInt(res.headers["content-length"] || "0", 10);
                logger.info("Total size " + formatBytes(totalSize));

                let downloaded = 0;
                let lastStatus = Date.now();

                const fileStream = fs.createWriteStream(PBF_FILE);

                res.on("data", (chunk) => {
                    downloaded += chunk.length;

                    if (totalSize && Date.now() - lastStatus > 1000) {
                        const percent = ((downloaded / totalSize) * 100).toFixed(1);
                        logger.info(`Downloading: ${percent}%`);
                        lastStatus = Date.now();
                    }
                });

                res.pipe(fileStream);

                fileStream.on("finish", () => {
                    fileStream.close(resolve);
                });

                fileStream.on("error", reject);
                res.on("error", reject);
            }).on("error", reject);
        }

        get(url);
    });
}

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

    await downloadPbfFile(parsedUrl);
    await importPbf();
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