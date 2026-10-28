import {
  ApiService, ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError, ApiMode, API_MODES, parseMode,
  type ApiModeDefinition, type ApiResponse, type CreateVoterRequest, type AddVoteRequest, type CastVoteRequest,
} from "@digitalvirgo/dvlive-api";

type PathParams = Record<string, string>;
interface HandlerOptions {
  env: (name: string) => string | undefined;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, bearer-token",
  "Access-Control-Expose-Headers": "Retry-After",
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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function error(status: number, message: string, headers: Record<string, string> = {}): Response {
  return json({ status: "error", code: status, message }, status, headers);
}

async function parseParams(req: Request, url: URL, action: ApiModeDefinition, mode: ApiMode) {
  if (req.method !== action.method) {
    throw new InputError(`Mode ${mode} requires ${action.method}.`, 405, { Allow: `${action.method}, OPTIONS` });
  }
  const params: PathParams = {};
  for (const key of action.params) {
    const value = url.searchParams.get(key);
    if (!value?.trim()) throw new InputError(`Required query parameter: ${key}.`);
    if (value === "." || value === "..") throw new InputError(`Invalid query parameter: ${key}.`);
    params[key] = value;
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
  return { params, body };
}

function callApi(api: ApiService, mode: ApiMode, params: PathParams, body?: unknown): Promise<ApiResponse<unknown>> {
  // SDK methods validate the untrusted JSON body before making an HTTP request.
  switch (mode) {
    case ApiMode.GetShowVote: return api.getShowVote(params.uuid!);
    case ApiMode.GetShowVoteChoice: return api.getShowVoteChoice(params.uuid!);
    case ApiMode.GetVoter: return api.getVoter(params.showVoteUuid!, params.userRef!);
    case ApiMode.CreateVoter: return api.createVoter(params.showVoteUuid!, body as CreateVoterRequest);
    case ApiMode.AddVote: return api.addVote(params.showVoteUuid!, params.userRef!, body as AddVoteRequest);
    case ApiMode.CastVote: return api.castVote(params.showVoteUuid!, params.userRef!, body as CastVoteRequest);
    default: {
      const unsupported: ApiMode = mode;
      throw new InputError(`Unsupported mode: ${unsupported}.`);
    }
  }
}

function forwardedHeaders(headers: Headers): Record<string, string> {
  const retryAfter = headers.get("retry-after");
  return retryAfter === null ? {} : { "Retry-After": retryAfter };
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
      const { params, body } = await parseParams(req, url, action, mode);
      const token = req.headers.get("bearer-token")?.trim();
      if (!token) throw new InputError("The bearer-token header is required (DV Live token without the Bearer prefix).", 401);
      const environment = env("DVLIVE_ENV");
      if (environment !== "STAG" && environment !== "PROD") {
        return error(500, 'Configure DVLIVE_ENV as "STAG" or "PROD" on the server.');
      }
      let api: ApiService;
      try {
        api = new ApiService({
          environment,
          headers: () => ({ Authorization: `Bearer ${token}` }),
        });
      } catch {
        return error(500, "Invalid DVLive SDK configuration.");
      }
      const result = await callApi(api, mode, params, body);
      return json(result.data, result.status, forwardedHeaders(result.headers));
    } catch (err) {
      if (err instanceof InputError) return error(err.status, err.message, err.headers);
      if (err instanceof ApiValidationError) return error(400, err.message);
      if (err instanceof ApiHttpError) {
        const headers = forwardedHeaders(err.headers);
        if (err.document !== undefined) return json(err.document, err.status, headers);
        return new Response(err.bodyText, {
          status: err.status,
          headers: { ...CORS_HEADERS, ...headers, "Content-Type": err.headers.get("content-type") ?? "text/plain; charset=utf-8" },
        });
      }
      if (err instanceof ApiRequestError) return error(err.kind === "timeout" ? 504 : 502, err.message);
      if (err instanceof ApiResponseError) return error(502, err.message, forwardedHeaders(err.headers));
      return error(500, "Internal DVLive error.");
    }
  };
}

export const handleRequest = createHandler({ env: (name) => Deno.env.get(name) });

if (typeof Deno !== "undefined") {
  Deno.serve(handleRequest);
}
