import logger from "fancy-log";
import got from "got";
import countryNames from "i18n-iso-countries";
import { JSDOM } from "jsdom";

export async function getPhotonCountries() {
    logger.info("Getting photon/graphhopper extracts from " + process.env.PHOTON_EXTRACTS_URL);

    const html = await got(process.env.PHOTON_EXTRACTS_URL).text();
    const dom = new JSDOM(html);
    const ids = [...dom.window.document.querySelectorAll("a")]
        .map(a => a.href.replace(/\/$/, ""))
        .filter(href => !href.endsWith(".."));

    logger.info(`Found ${ids.length} countries`);

    return ids;
}

export async function setupCountryList(redis, force = false) {
    let countries = await redis.get("countries");
    if (countries && !force) {
        logger.info("Loading countries from cache");
        return JSON.parse(countries);
    }

    const photon_countries = new Set(await getPhotonCountries());

    logger.info("Getting openstreetmap country list from " + process.env.COUNTRY_LIST_URL);
    const data = await got(process.env.COUNTRY_LIST_URL).json();

    countries = {};

    const notFound = new Set();

    data.features.forEach(feature => {
        if (typeof feature.properties["iso3166-1:alpha2"] === "undefined") return;

        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        feature.geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ring.forEach(([lng, lat]) => {
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                });
            });
        });

        feature.properties["iso3166-1:alpha2"].forEach(countryCode => {
            if (notFound.has(countryCode)) return;

            if (!photon_countries.has(countryCode.toLowerCase())) {
                notFound.add(countryCode);
                return;
            }

            countries[countryCode] = {
                code: countryCode.toLowerCase(),
                name: countryNames.getName(countryCode, "en"),
                region: feature.properties.parent + "/" + feature.properties.id,
                bbox: [minLng, minLat, maxLng, maxLat]
            }
        });
    });

    //sort by key
    countries = Object.keys(countries)
        .sort()
        .reduce((acc, key) => {
            acc[key] = countries[key];
            return acc;
        }, {});

    await redis.set("countries", JSON.stringify(countries));

    logger.info(`Skipped ${[...notFound.values()].sort().join(",")} because they are not found in graphhopper extracts`);
    logger.info(`Found ${Object.keys(countries).length} countries`)

    return countries;
}