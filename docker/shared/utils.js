import logger from "fancy-log";
import got from "got";
import Redis from "ioredis";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { access, readdir, readFile, rm, writeFile } from "node:fs/promises";

export function handleSigterm(cb) {
    ['SIGTERM', 'SIGINT'].forEach(sig => process.on(sig, async () => {
        logger.info(`${sig} received`);

        await cb();

        setTimeout(() => process.exit(0), 0);
    }));
}

export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const delay = ms => new Promise(res => setTimeout(res, ms));

// ======== process handling ========

const processes = {};

export async function stopProcess(id) {
    if (!isRunning(id)) return;

    return new Promise((resolve, reject) => {
        processes[id].once('exit', (code, signal) => {
            resolve();
        });

        logger.info("killing " + id);
        processes[id].kill('SIGTERM');
    });
}

export async function stopAllProcesses() {
    logger.info('stopping processes');

    for (const id in processes) {
        await stopProcess(id);
    }
}

export function launchProcess(id, binary, args, opts = {}) {
    logger.info(binary, args.join(" "));

    const process = spawn(binary, args);

    processes[id] = process;

    process.on('exit', (code, signal) => {
        logger.info(`service exited with code ${code} and signal ${signal}`);
        delete processes[id];
        if (opts.onExit) opts.onExit(code, signal);
    });

    process.stdout.setEncoding('utf8');
    process.stdout.on('data', function (data) {
        data.toString().split(/\r?\n/).forEach(line => {
            if (line) {
                logger.info("[" + id + "] " + line);
                if (opts.onLog) opts.onLog(line);
            }
        });
    });

    process.stderr.setEncoding('utf8');
    process.stderr.on('data', function (data) {
        data.toString().split(/\r?\n/).forEach(line => {
            if (line) {
                logger.info("[" + id + "] " + line);
                if (opts.onLog) opts.onLog(line);
            }
        });
    });

    return process;
}

export function isRunning(id) {
    return typeof processes[id] !== "undefined";
}

// ======== redis handling ========

export function getRedis() {
    const redis = new Redis(process.env.REDIS_URL, {
        retryStrategy(times) {
            logger.info("Connection retry #" + times + " in 5 seconds");
            return 5000;
        },
        maxRetriesPerRequest: -1
    });

    redis.on("error", (err) => {
        if (err.code === "ECONNREFUSED") {
            logger.error("Could not connect to " + process.env.REDIS_URL);
            return;
        }

        logger.error(err);
    });

    return redis;
}

export function setupRedis(listenChannel, msgCb) {
    const redis = getRedis();

    redis.subscribe(listenChannel, (err, count) => {
        if (err) {
            logger.error('failed to subscribe to redis channel:', err);
            process.exit(1);
        }

        logger.info(`subscribed to ${count} channel(s). Waiting for commands`);
    });

    redis.on('message', (channel, message) => {
        logger.info(`received command: ${message}`);

        let payload;

        try {
            payload = JSON.parse(message);
        } catch (error) {
            logger.warn("Expected JSON payload, got " + message);
            return;
        }

        msgCb(payload);
    });

    return redis;
}

// ======== simple filedownload ========

export async function downloadFile(url, targetFile) {
    await rm(targetFile, { force: true });

    const downloadStream = got.stream(url);
    const fileStream = fs.createWriteStream(targetFile);

    return new Promise((resolve, reject) => {
        let lastStatus = 0;

        downloadStream.on("downloadProgress", progress => {
            if (Date.now() - lastStatus > 1000 && progress.total) {
                const percent = (progress.percent * 100).toFixed(1);
                logger.info(`Downloading: ${percent}% - ${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`);
                lastStatus = Date.now();
            }
        });

        downloadStream.on("error", reject);
        fileStream.on("error", reject);
        fileStream.on("finish", resolve);

        downloadStream.pipe(fileStream);
    });
}

// ======== fs helpers ========

export async function fileExists(filepath) {
    try {
        await access(filepath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return null;
    }
}

export async function directoryEmpty(dir) {
    try {
        const files = await readdir(dir);

        if (files.length === 0) {
            logger.info(`data directory ${dir} exists but is empty`);
            return true;
        }
    } catch (error) {
        logger.info(`could not read directory ${dir}`);
    }

    return false;
}

// ======== deployment ========

const DEPLOYMENT_FILE = "/deployment.state";

export async function setExpectedDeployment(expectedValue) {
    await writeFile(DEPLOYMENT_FILE, expectedValue);
}

export async function isExpectedDeployment(expectedValue) {
    if (!(await fileExists(DEPLOYMENT_FILE))) return false;

    try {
        const val = await readFile(DEPLOYMENT_FILE, "utf8");
        return val == expectedValue;
    } catch (error) {
        logger.error(error);
    }

    return false;
}