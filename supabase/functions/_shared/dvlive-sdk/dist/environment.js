const BASE_URLS = {
    DEV: "https://dev-webshow-engine.dv-live.com",
    STAG: "https://stag-webshow-engine.dv-live.com",
    PROD: "https://webshow-engine.dv-live.com",
};
const INTERNAL_BASE_URLS = {
    DEV: "https://int-dev-webshow-engine.dv-live.com",
    STAG: "https://int-stag-webshow-engine.dv-live.com",
    PROD: "https://int-webshow-engine.dv-live.com",
};
export function resolveBaseUrl(environment, mode = "PROD") {
    if (mode !== "INT" && mode !== "PROD") {
        throw new TypeError('mode must be "INT" or "PROD".');
    }
    if (environment !== "DEV" && environment !== "STAG" && environment !== "PROD") {
        throw new TypeError('environment must be "DEV", "STAG" or "PROD".');
    }
    return (mode === "INT" ? INTERNAL_BASE_URLS : BASE_URLS)[environment];
}
//# sourceMappingURL=environment.js.map