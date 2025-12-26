import { spawn } from 'child_process';
import logger from "fancy-log";
import { mkdir, rm } from 'fs/promises';
import https from 'https';
import path from 'path';
import { formatBytes } from "../shared/utils.js";
import { updateDiskUsage } from './status.js';

async function downloadAndExtract(url) {
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

export async function downloadCountry(countryCode) {
    const parsedUrl = process.env.COUNTRY_DOWNLOAD_URL.replace(/<COUNTRY>/g, countryCode);
    logger.info(`Downloading country "${countryCode}" from "${parsedUrl}"`);

    try {
        await downloadAndExtract(parsedUrl);
        await updateDiskUsage();

        logger.info('Download and extraction complete!');
    } catch (err) {
        logger.error('Error:', err);
    }
}