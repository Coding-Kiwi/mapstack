import "@dotenvx/dotenvx/config";
import { initMapstackService } from "../shared/mapstack.js";
import Photon from "./photon.js";

(async () => {
    const photon = new Photon();
    await initMapstackService(photon);
})();