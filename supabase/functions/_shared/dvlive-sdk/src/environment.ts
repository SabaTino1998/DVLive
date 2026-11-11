export type ApiEnvironment = "DEV" | "STAG" | "PROD";

const BASE_URLS: Readonly<Record<ApiEnvironment, string>> = {
  DEV: "https://dev-webshow-engine.dv-live.com",
  STAG: "https://stag-webshow-engine.dv-live.com",
  PROD: "https://webshow-engine.dv-live.com",
};

const LOCAL_BASE_URLS: Readonly<Record<ApiEnvironment, string>> = {
  DEV: "https://int-dev-webshow-engine.dv-live.com",
  STAG: "https://int-stag-webshow-engine.dv-live.com",
  PROD: "https://int-webshow-engine.dv-live.com",
};

export function resolveBaseUrl(environment: string | undefined, mode: string = "PROD"): string {
  if (mode !== "LOCAL" && mode !== "PROD") {
    throw new TypeError('mode must be "LOCAL" or "PROD".');
  }
  if (environment !== "DEV" && environment !== "STAG" && environment !== "PROD") {
    throw new TypeError('environment must be "DEV", "STAG" or "PROD".');
  }
  return (mode === "LOCAL" ? LOCAL_BASE_URLS : BASE_URLS)[environment];
}
