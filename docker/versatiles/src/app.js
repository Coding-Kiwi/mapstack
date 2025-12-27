import "@dotenvx/dotenvx/config";
import { initMapstackService } from "../shared/mapstack.js";
import Versatiles from "./versatiles.js";

(async () => {
    const versatiles = new Versatiles();
    await initMapstackService(versatiles);
})();