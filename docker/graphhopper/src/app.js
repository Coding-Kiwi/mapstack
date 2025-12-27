import "@dotenvx/dotenvx/config";
import { initMapstackService } from "../shared/mapstack.js";
import Graphhopper from "./graphhopper.js";

(async () => {
    const graphhopper = new Graphhopper();
    await initMapstackService(graphhopper);
})();