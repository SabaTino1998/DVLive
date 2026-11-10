type ApiEnvironment = "STAG" | "PROD";

export type AlbTokenSlot = "dev" | "stag" | "prod";

const BASE_URLS: Readonly<Record<ApiEnvironment, string>> = {
  STAG: "https://dev-webshow-engine.dv-live.com",
  PROD: "https://webshow-engine.dv-live.com",
};

const ALB_TOKEN_HOSTS: Readonly<Record<string, AlbTokenSlot>> = {
  "dev-webshow-engine.dv-live.com": "dev",
  "stag-webshow-engine.dv-live.com": "stag",
  "webshow-engine.dv-live.com": "prod",
};

export function resolveBaseUrl(environment: string | undefined): string {
  if (environment !== "STAG" && environment !== "PROD") {
    throw new TypeError('environment must be "STAG" or "PROD".');
  }
  return BASE_URLS[environment];
}

/** Returns the ALB token slot for a request host, or undefined when the host is unknown. */
export function resolveAlbTokenSlot(hostname: string): AlbTokenSlot | undefined {
  return ALB_TOKEN_HOSTS[hostname];
}
