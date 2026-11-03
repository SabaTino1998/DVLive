const BASE_URLS = {
    STAG: "https://dev-webshow-engine.dv-live.com",
    PROD: "https://webshow-engine.dv-live.com",
};
export function resolveBaseUrl(environment) {
    if (environment !== "STAG" && environment !== "PROD") {
        throw new TypeError('environment must be "STAG" or "PROD".');
    }
    return BASE_URLS[environment];
}
//# sourceMappingURL=environment.js.map