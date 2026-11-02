import {
  ApiService, ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError, ApiModes, API_MODES, parseMode,
  type ApiModeDefinition, type ApiResponse, type ApiResult,
} from "@digitalvirgo/dvlive-api";

interface HandlerOptions {
  env: (name: string) => string | undefined;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, bearer-token",
};

class InputError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(message: string, status = 400, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

async function importJwtKey(env: HandlerOptions["env"]): Promise<CryptoKey> {
  const secret = env("APP_JWT_SECRET") ?? env("SUPABASE_JWT_SECRET");
  if (!secret) throw new Error("JWT secret not configured");
  return await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

interface NormalizedAppClaims {
  sub: string;
  app_role: string;
  service_id: string | null;
  product_id: string | null;
}

// Same normalization as Bravigo's avatar-generate/index.ts.
function normalizeAppClaims(raw: Record<string, unknown>): NormalizedAppClaims | null {
  const meta = raw.app_metadata && typeof raw.app_metadata === "object"
    ? raw.app_metadata as Record<string, unknown> : {};
  const sub = typeof raw.sub === "string" ? raw.sub : "";
  const app_role = String(raw.app_role ?? meta.app_role ?? "");
  const service_id = String(raw.service_id ?? meta.service_id ?? "") || null;
  const product_id = String(raw.product_id ?? meta.product_id ?? "") || null;
  if (!sub || app_role !== "app_user") return null;
  return { sub, app_role, service_id, product_id };
}

async function requireUser(req: Request, env: HandlerOptions["env"]): Promise<string> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw new InputError("Missing bearer token.", 401);
  let verified: Record<string, unknown>;
  try {
    const key = await importJwtKey(env);
    const { verify: jwtVerify } = await import("jsr:@zaubrik/djwt@3.0.2");
    verified = await jwtVerify(auth.slice(7).trim(), key);
  } catch {
    throw new InputError("Invalid token.", 401);
  }
  const claims = normalizeAppClaims(verified);
  if (!claims) throw new InputError("Not an app_user token.", 403);
  return claims.sub;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function error(status: number, message: string, headers: Record<string, string> = {}): Response {
  return json({ status: "error", code: status, message }, status, headers);
}

async function parseRequest(req: Request, action: ApiModeDefinition, mode: ApiModes) {
  if (req.method !== action.method) {
    throw new InputError(`Mode ${mode} requires ${action.method}.`, 405, { Allow: `${action.method}, OPTIONS` });
  }
  let body: unknown;
  if (action.method === "POST") {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
      throw new InputError("The request body must use application/json.", 415);
    }
    try {
      body = await req.json();
    } catch {
      throw new InputError("Invalid JSON body.");
    }
  }
  return body;
}

function callApi(api: ApiService, mode: ApiModes, query: URLSearchParams, body?: unknown, userRef = ""): Promise<ApiResponse<ApiResult>> {
  const uuid = query.get("uuid") ?? "";
  const showVoteUuid = query.get("showVoteUuid") ?? "";

  // SDK methods validate parameters and the JSON body before making an HTTP request.
  switch (mode) {
    case ApiModes.GetShowVote: return api.getShowVote(uuid);
    case ApiModes.GetShowVoteChoice: return api.getShowVoteChoice(uuid);
    case ApiModes.GetVoter: return api.getVoter({ showVoteUuid, userRef });
    case ApiModes.CreateVoter: return api.createVoter({ showVoteUuid },
      body && typeof body === "object" && !Array.isArray(body) ? { ...body, uniqRef: userRef } : body);
    case ApiModes.CastVote: return api.castVote({ showVoteUuid, userRef }, body);
    default: {
      const unsupported: ApiModes = mode;
      throw new InputError(`Unsupported mode: ${unsupported}.`);
    }
  }
}

export function createHandler({ env }: HandlerOptions) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    try {
      const url = new URL(req.url);
      const parsed = parseMode(url.searchParams.get("mode"));
      if (parsed.mode === null) return json(parsed.catalog);
      const mode = parsed.mode;
      const action = API_MODES[mode];
      const body = await parseRequest(req, action, mode);
      const token = req.headers.get("bearer-token")?.trim();
      if (!token) throw new InputError("The bearer-token header is required (DV Live token without the Bearer prefix).", 401);
      const needsUser = mode === ApiModes.GetVoter || mode === ApiModes.CreateVoter || mode === ApiModes.CastVote;
      const userRef = needsUser ? await requireUser(req, env) : "";
      let api: ApiService;
      try {
        api = new ApiService({
          environment: env("DVLIVE_ENV"),
          logEnable: env("DVLIVE_LOG_ENABLE"),
          logLevel: env("DVLIVE_LOG_LEVEL"),
          headers: () => ({ Authorization: `Bearer ${token}` }),
        });
      } catch {
        return error(500, "Invalid DVLive SDK configuration.");
      }
      const result = await callApi(api, mode, url.searchParams, body, userRef);
      return json(result.data, result.status);
    } catch (err) {
      if (err instanceof InputError) return error(err.status, err.message, err.headers);
      if (err instanceof ApiValidationError) return error(400, err.message);
      if (err instanceof ApiHttpError) {
        if (err.document !== undefined) return json(err.document, err.status);
        return new Response(err.bodyText, {
          status: err.status,
          headers: { ...CORS_HEADERS, "Content-Type": err.headers.get("content-type") ?? "text/plain; charset=utf-8" },
        });
      }
      if (err instanceof ApiRequestError) return error(err.kind === "timeout" ? 504 : 502, err.message);
      if (err instanceof ApiResponseError) return error(502, err.message);
      return error(500, "Internal DVLive error.");
    }
  };
}

export const handleRequest = createHandler({ env: (name) => Deno.env.get(name) });

Deno.serve(handleRequest);
