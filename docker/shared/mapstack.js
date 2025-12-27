import logger from "fancy-log";
import fastFolderSize from "fast-folder-size";
import { promisify } from "node:util";
import { fileExists, formatBytes, getRedis, handleSigterm, isExpectedDeployment, setupRedis, stopAllProcesses } from "./utils.js";

export class MapstackService {
    constructor(name) {
        this.name = name;
    }

    async initEnvMode() {
        logger.info("Starting in .env standalone mode");

        const expectedDeployment = this.getExpectedDeployment();

        //attempt to start
        if (await this.isDataDirValid()) {
            //we have a valid data dir
            logger.info("Data directory seems fine");

            if (expectedDeployment) {
                logger.info("Expecting deployment " + expectedDeployment);

                //BBOX is configured, check deployment
                if (await isExpectedDeployment(expectedDeployment)) {
                    logger.info(`Expected deployment ${expectedDeployment} OK`);
                } else {
                    logger.info(`Current deployment is not ${expectedDeployment}, update`);

                    await this.prepareDeployment(expectedDeployment);
                }
            }

            await this.start();
            return;
        }

        if (!expectedDeployment) {
            logger.error("relevant .env is not defined or empty");
            process.exit(1);
        }

        //data dir not set up, check if we can download
        await this.prepareDeployment(expectedDeployment);

        //download is done, folder is ok, start
        await this.start();
    }

    async initManagedMode() {
        logger.info("Starting in managed mode");

        this.redis = getRedis();

        await this.updateDiskUsage();

        setupRedis("mapstack", msg => {
            this.handleMessage(msg);
        });

        //attempt to start
        if (await this.isDataDirValid()) {
            logger.info("Data directory seems fine, starting");
            await this.start();
        } else {
            logger.info("Data directory not ready. waiting for deployment trigger");
        }
    }

    async init() {
        if (process.env.MANAGED === "true") {
            logger.info("REDIS_URL is " + process.env.REDIS_URL + ", running in managed mode");
            await this.initManagedMode();
        } else {
            logger.info("Not managed, running in .env mode");
            await this.initEnvMode();
        }
    }

    async updateDeployment(deployment) {
        logger.info(`Updating deployment to ${deployment}`);

        await this.stop();
        await this.updateStatus("starting");
        await this.prepareDeployment(deployment);
        await this.start();
    }

    async getDiskUsage() {
        if (!(await fileExists(this.getDataPath()))) return null;

        const fastFolderSizeAsync = promisify(fastFolderSize);
        const bytes = await fastFolderSizeAsync(this.getDataPath());

        return formatBytes(bytes);
    }

    async updateDiskUsage() {
        if (!this.redis) return;
        this.redis.set(this.name + ".disk_usage", await this.getDiskUsage());
    }

    async updateStatus(status) {
        if (!this.redis) return;

        logger.info("status " + status)
        this.redis.set(this.name + ".status", status);
    }
}

export async function initMapstackService(service) {
    handleSigterm(() => {
        stopAllProcesses();
        service.updateStatus("offline");
    });

    await service.init();
}