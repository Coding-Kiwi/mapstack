import { launchProcess, stopProcess } from "../shared/utils.js";
import { updateStatus } from "./status.js";

export async function start() {
    await updateStatus("starting");

    launchProcess("photon.jar", "java", ["-jar", "photon.jar"], {
        onLog(line) {
            if (line.includes(process.env.LOG_READY_MATCH)) {
                updateStatus("online");
            }
        },
        onExit() {
            updateStatus("offline");
        }
    });
}

export async function stop() {
    await stopProcess("photon.jar");
}