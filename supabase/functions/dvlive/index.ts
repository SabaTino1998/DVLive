import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ApiService,
  ApiHttpError,
  ApiRequestError,
  ApiResponseError,
  ApiValidationError,
  ApiModes,
  API_MODES,
  parseMode,
  type ApiModeDefinition,
  type ApiResult,
  type ApiResponse,
} from "@digitalvirgo/dvlive-api";
import { verifyAppJwt } from "../_shared/verify-app-jwt.ts";

interface HandlerOptions {
  env: (name: string) => string | undefined;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

function ok(data: unknown, status = 200): Response {
  return json({ ok: true, data }, status);
}

function fail(
  status: number,
  message: string,
  code: string,
  details?: unknown,
  headers: Record<string, string> = {},
): Response {
  const error: Record<string, unknown> = { message, code };
  if (details !== undefined) error.details = details;
  return json({ ok: false, error }, status, headers);
}

class InputError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;

  constructor(
    message: string,
    status = 400,
    code = "VALIDATION",
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function trimSecret(value: string | undefined): string {
  return value?.trim() ?? "";
}

async function parseRequestBody(req: Request, action: ApiModeDefinition, mode: ApiModes): Promise<unknown> {
  if (req.method !== action.method) {
    throw new InputError(
      `Mode ${mode} requires ${action.method}.`,
      405,
      "METHOD_NOT_ALLOWED",
      { Allow: `${action.method}, OPTIONS` },
    );
  }
  if (action.method !== "POST") return undefined;
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    throw new InputError("The request body must use application/json.", 415, "INVALID_JSON");
  }
  try {
    return await req.json();
  } catch {
    throw new InputError("Invalid JSON body.", 400, "INVALID_JSON");
  }
}

function callApi(
  api: ApiService,
  mode: ApiModes,
  query: URLSearchParams,
  body: unknown,
  userRef: string,
): Promise<ApiResponse<ApiResult>> {
  const uuid = query.get("uuid") ?? "";
  const showVoteUuid = query.get("showVoteUuid") ?? "";

  switch (mode) {
    case ApiModes.GetShowVote:
      return api.getShowVote(uuid);
    case ApiModes.GetShowVoteChoice:
      return api.getShowVoteChoice(uuid);
    case ApiModes.GetVoter:
      return api.getVoter({ showVoteUuid, userRef });
    case ApiModes.CreateVoter:
      return api.createVoter(
        { showVoteUuid },
        body && typeof body === "object" && !Array.isArray(body)
          ? { ...body, uniqRef: userRef }
          : { uniqRef: userRef },
      );
    case ApiModes.CastVote:
      return api.castVote({ showVoteUuid, userRef }, body);
    default: {
      const unsupported: ApiModes = mode;
      throw new InputError(`Unsupported mode: ${unsupported}.`, 400, "VALIDATION");
    }
  }
}

export function createHandler({ env }: HandlerOptions) {
  return async (req: Request): Promise<Response> => {
    // Route Deno.env.get through the injected env so verifyAppJwt and tests share one source.
    const denoEnv = Deno.env as { get: (name: string) => string | undefined };
    const previousGet = denoEnv.get;
    denoEnv.get = (name: string) => env(name);
    try {
      return await handleRequestWithEnv(req, env);
    } finally {
      denoEnv.get = previousGet;
    }
  };
}

async function handleRequestWithEnv(
  req: Request,
  env: HandlerOptions["env"],
): Promise<Response> {
  const ts = new Date().toISOString();
  let tag = "[DVLive][unset]";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const parsed = parseMode(url.searchParams.get("mode"));
    if (parsed.mode === null) {
      console.log(`${tag} ${ts} | catalog`);
      return ok(parsed.catalog);
    }

    const dvliveEnv = trimSecret(env("DVLIVE_ENV"));
    tag = `[DVLive][${dvliveEnv || "unset"}]`;
    const mode = parsed.mode;
    const action = API_MODES[mode];
    const body = await parseRequestBody(req, action, mode);

    const auth = await verifyAppJwt(req);
    if (!auth.ok) {
      console.log(`${tag} ${ts} | auth failed mode=${mode} status=${auth.status}`);
      return fail(
        auth.status,
        auth.message,
        auth.status === 403
          ? "FORBIDDEN"
          : auth.status === 500
          ? "SERVER_MISCONFIGURED"
          : auth.status === 502
          ? "AUTH_SERVICE_ERROR"
          : "AUTH_REQUIRED",
      );
    }

    const needsUser =
      mode === ApiModes.GetVoter ||
      mode === ApiModes.CreateVoter ||
      mode === ApiModes.CastVote;
    const userRef = auth.claims.absolute_reference?.trim() ?? "";
    if (needsUser && !userRef) {
      return fail(403, "Missing absolute_reference claim.", "FORBIDDEN");
    }

    const dvliveMode = env("DVLIVE_MODE")?.trim() ?? "PROD";
    const albToken = dvliveMode === "INT"
      ? undefined
      : trimSecret(env(`DVLIVE_ALB_TOKEN_${dvliveEnv}`)) || undefined;

    let api: ApiService;
    try {
      const apiToken = trimSecret(env("DVLIVE_API_TOKEN"));
      if (!apiToken) {
        throw new TypeError("DVLIVE_API_TOKEN is required.");
      }
      api = new ApiService({
        environment: dvliveEnv,
        mode: dvliveMode,
        logEnable: env("DVLIVE_LOG_ENABLE"),
        logLevel: env("DVLIVE_LOG_LEVEL"),
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(albToken ? { "X-Internal-Auth": albToken } : {}),
        },
      });
    } catch (err) {
      console.error(`${tag} ${ts} | invalid SDK config:`, err instanceof Error ? err.message : err);
      return fail(500, "Invalid DVLive SDK configuration.", "SERVER_MISCONFIGURED");
    }

    console.log(
      `${tag} ${ts} | mode=${mode}${needsUser ? ` user=${userRef.slice(0, 4)}***` : ""}`,
    );
    const result = await callApi(api, mode, url.searchParams, body, userRef);
    return ok(result.data, result.status);
  } catch (err) {
    if (err instanceof InputError) {
      return fail(err.status, err.message, err.code, undefined, err.headers);
    }
    if (err instanceof ApiValidationError) {
      return fail(400, err.message, "VALIDATION");
    }
    if (err instanceof ApiHttpError) {
      if (err.document !== undefined) {
        return fail(err.status, "DV Live upstream error.", "UPSTREAM_ERROR", err.document);
      }
      return fail(err.status, err.bodyText || "DV Live upstream error.", "UPSTREAM_ERROR");
    }
    if (err instanceof ApiRequestError) {
      return fail(
        err.kind === "timeout" ? 504 : 502,
        err.message,
        err.kind === "timeout" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      );
    }
    if (err instanceof ApiResponseError) {
      return fail(502, err.message, "UPSTREAM_ERROR");
    }
    console.error(`${tag} ${ts} | unexpected:`, err instanceof Error ? err.message : err);
    return fail(500, "Internal DVLive error.", "INTERNAL_ERROR");
  }
}

// Bound inside this export so Node edge tests, which strip from handleRequest onward,
// never touch Deno.env at import time. The bind also avoids recursion when createHandler
// temporarily replaces Deno.env.get for verifyAppJwt.
export const handleRequest = (() => {
  const denoEnvGet = Deno.env.get.bind(Deno.env);
  return createHandler({ env: (name) => denoEnvGet(name) });
})();

Deno.serve(handleRequest);
