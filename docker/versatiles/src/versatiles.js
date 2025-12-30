import logger from "fancy-log";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MapstackService } from "../shared/mapstack.js";
import { downloadFile, fileExists, launchProcess, setExpectedDeployment, stopProcess } from "../shared/utils.js";

export default class Versatiles extends MapstackService {
    constructor() {
        super("versatiles");
    }

    // === service functions ===

    getExpectedDeployment() {
        return process.env.BBOX || "planet";
    }

    getDataPath() {
        return process.env.VT_DATA_PATH;
    }

    handleMessage(msg) {
        if (msg.cmd === "versatiles.set-bbox") {
            this.updateDeployment(msg.bbox);
            return;
        }
    }

    async isDataDirValid() {
        const sources = await this.getSources();
        return sources.length > 0;
    }

    async prepareDeployment(deployment) {
        await setExpectedDeployment("");

        if (deployment === "planet") {
            await downloadFile(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles");
            await downloadFile(process.env.DOWNLOAD_URL + "/hillshade-vectors.versatiles", process.env.VT_DATA_PATH + "/hillshade-vectors.versatiles");
            await downloadFile(process.env.DOWNLOAD_URL + "/landcover-vectors.versatiles", process.env.VT_DATA_PATH + "/landcover-vectors.versatiles");
            await setExpectedDeployment("planet");
        } else {
            await this.convert(process.env.DOWNLOAD_URL + "/osm.versatiles", process.env.VT_DATA_PATH + "/osm.versatiles", deployment);
            await this.convert(process.env.DOWNLOAD_URL + "/hillshade-vectors.versatiles", process.env.VT_DATA_PATH + "/hillshade-vectors.versatiles", deployment);
            await this.convert(process.env.DOWNLOAD_URL + "/landcover-vectors.versatiles", process.env.VT_DATA_PATH + "/landcover-vectors.versatiles", deployment);
            await setExpectedDeployment(deployment);
        }

        if (!(await this.isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        await this.updateDiskUsage();
    }

    async start() {
        await this.updateStatus("starting");

        const sources = await this.getSources();

        logger.info(`Launching with sources ${sources.join(",")}`);

        launchProcess("versatiles", process.env.VT_BINARY_PATH, [
            "serve",
            "--config", process.env.VT_CONFIG_PATH,
            "-s", "[/sprites]" + process.env.VT_ASSETS_PATH + "/sprites.tar.gz",
            "-s", "[/fonts]" + process.env.VT_ASSETS_PATH + "/fonts.tar.gz",
            ...sources
        ], {
            onLog: (line) => {
                if (line.includes(process.env.LOG_READY_MATCH)) {
                    this.updateStatus("online");
                }
            },
            onExit: () => {
                this.updateStatus("offline");
            }
        });
    }

    async stop() {
        await stopProcess("versatiles");
    }

    // === custom functions ===

    async getSources() {
        if (!(await fileExists(process.env.VT_DATA_PATH))) {
            logger.info(`data directory ${process.env.VT_DATA_PATH} does not exist`);
            return [];
        }

        const files = await readdir(process.env.VT_DATA_PATH);
        return files
            .filter(f => f.endsWith(".versatiles"))
            .map(f => resolve(process.env.VT_DATA_PATH, f));
    }


    convert(url, outpath, bbox = null) {
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
}