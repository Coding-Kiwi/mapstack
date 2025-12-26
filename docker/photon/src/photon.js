import { launchProcess, stopProcess } from "../shared/utils.js";

export async function start() {
    launchProcess("photon.jar", "java", ["-jar", "photon.jar"]);
}

export async function stop() {
    stopProcess("photon.jar");
}