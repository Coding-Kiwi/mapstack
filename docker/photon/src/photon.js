import { spawn } from 'child_process';
import logger from "fancy-log";
import { mkdir, rm } from 'fs/promises';
import https from 'https';
import path from 'path';
import { MapstackService } from "../shared/mapstack.js";
import { directoryEmpty, fileExists, formatBytes, launchProcess, setExpectedDeployment, stopProcess } from "../shared/utils.js";

export default class Photon extends MapstackService {
    constructor() {
        super("photon");
    }

    // === service functions ===

    getExpectedDeployment() {
        return process.env.COUNTRY;
    }

    getDataPath() {
        return process.env.PROTON_DATA_PATH;
    }

    handleMessage(msg) {
        if (msg.cmd === "photon.set-country") {
            this.updateDeployment(msg.country);
            return;
        }
    }

    async isDataDirValid() {
        const indexPath = path.resolve(process.env.PROTON_DATA_PATH, "node_1");
        if (!(await fileExists(indexPath))) return false;
        return !(await directoryEmpty(indexPath));
    }

    async prepareDeployment(deployment) {
        await setExpectedDeployment("");

        const parsedUrl = process.env.COUNTRY_DOWNLOAD_URL.replace(/<COUNTRY>/g, deployment);
        logger.info(`Downloading country "${deployment}" from "${parsedUrl}"`);

        await this.downloadAndExtract(parsedUrl);
        await setExpectedDeployment(deployment);

        if (!(await this.isDataDirValid())) {
            logger.error("Download finished but data directory still empty, something is wrong.")
            process.exit(1);
        }

        await this.updateDiskUsage();
    }

    async start() {
        await this.updateStatus("starting");

        launchProcess("photon.jar", "java", ["-jar", "photon.jar"], {
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
        await stopProcess("photon.jar");
    }

    // === custom functions ===
    async downloadAndExtract(url) {
        //force-clean the directory and recreate it

        const indexPath = path.resolve(process.env.PROTON_DATA_PATH, "node_1");
        await rm(indexPath, { recursive: true, force: true });
        await mkdir(process.env.PROTON_DATA_PATH, { recursive: true });

        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to download, status code: ${res.statusCode}`));
                    return;
                }

                const totalSize = parseInt(res.headers['content-length'] || '0', 10);

                logger.info("Total size " + formatBytes(totalSize));

                let downloaded = 0;
                let lastStatus = Date.now();

                res.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (totalSize) {
                        const percent = ((downloaded / totalSize) * 100).toFixed(1);
                        if (Date.now() - lastStatus > 1000) {
                            logger.info(`Downloading: ${percent}%`);
                            lastStatus = Date.now();
                        }
                    }
                });

                // Spawn bzip2 -cd
                const bzip2 = spawn('bzip2', ['-cd'], { stdio: ['pipe', 'pipe', 'inherit'] });

                //the tar has a folde called photon_data so it should land in /app/photon_data
                const tar = spawn('tar', ['-x'], { stdio: ['pipe', 'inherit', 'inherit'], cwd: '/app' });

                // Pipe download -> bzip2 -> tar
                res.pipe(bzip2.stdin);
                bzip2.stdout.pipe(tar.stdin);

                tar.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`tar exited with code ${code}`));
                    }
                });

                bzip2.on('error', reject);
                tar.on('error', reject);
            }).on('error', reject);
        });
    }
}