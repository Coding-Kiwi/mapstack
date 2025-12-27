import logger from "fancy-log";
import { join } from "node:path";
import { MapstackService } from "../shared/mapstack.js";
import { directoryEmpty, downloadFile, fileExists, launchProcess, setExpectedDeployment, stopProcess } from "../shared/utils.js";

export default class Graphhopper extends MapstackService {
    constructor() {
        super("graphhopper");

        this.pbf_file = join(process.env.GH_DATA_PATH, "input.osm.pbf");
        this.cache_dir = join(process.env.GH_DATA_PATH, "cache");
    }

    // === service functions ===

    getExpectedDeployment() {
        return process.env.REGION;
    }

    getDataPath() {
        return this.cache_dir;
    }

    handleMessage(msg) {
        if (msg.cmd === "graphhopper.set-region") {
            this.updateDeployment(msg.region);
            return;
        }
    }

    async isDataDirValid() {
        if (!(await fileExists(this.cache_dir))) return false;
        return !(await directoryEmpty(this.cache_dir));
    }

    async prepareDeployment(deployment) {
        await setExpectedDeployment("");

        const parsedUrl = process.env.REGION_DOWNLOAD_URL.replace(/<REGION>/g, deployment);
        logger.info(`Downloading region "${deployment}" from "${parsedUrl}"`);

        await downloadFile(parsedUrl, this.pbf_file);
        await this.importPbf();

        await setExpectedDeployment(deployment);

        if (!(await this.isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        await this.updateDiskUsage();
    }

    async start() {
        await this.updateStatus("starting");

        launchProcess("graphhopper", "java", [
            '-Xmx2g',
            `-Ddw.graphhopper.graph.location=${this.cache_dir}`,
            '-jar', process.env.GH_BINARY_PATH,
            'server', process.env.GH_CONFIG_PATH
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
        await stopProcess("graphhopper");
    }

    // === custom functions ===
    async importPbf() {
        return new Promise((resolve, reject) => {
            logger.info(`Importing "${this.pbf_file}" using target cache "${this.cache_dir}"`);

            let importProcess = launchProcess("graphhopper-import", "java", [
                '-Xmx4g', '-Xms4g',
                '-Ddw.graphhopper.datareader.file=' + this.pbf_file,
                '-Ddw.graphhopper.graph.location=' + this.cache_dir,
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
}