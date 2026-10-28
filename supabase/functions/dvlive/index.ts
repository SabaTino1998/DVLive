type PathParams = Record<string, string>;
type JsonObject = Record<string, unknown>;
interface Mode {
  method: "GET" | "POST";
  params: string[];
  body: string[];
  requiredBody?: string[];
  description: string;
  response: string;
  path: (params: PathParams) => string;
}
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

export const modes: Record<string, Mode> = {
  getShowVoteChoice: {
    method: "GET", params: ["uuid"], body: [],
    description: "Returns a participant: UUID, name, status, order, biography, images, and elimination/reintroduction rounds.",
    response: "ShowVoteChoiceResponse",
    path: ({ uuid }) => `/show-vote-choice/${uuid}`,
  },
  getShowVote: {
    method: "GET", params: ["uuid"], body: [],
    description: "Returns the show name and dates, current round, and its participants.",
    response: "ShowVoteResponse",
    path: ({ uuid }) => `/show-vote/${uuid}`,
  },
  createVoter: {
    method: "POST", params: ["showVoteUuid"], body: ["email", "phone", "uniqRef"],
    description: "Registers a voter and returns the operation result (status, code, message).",
    response: "OperationResult",
    path: ({ showVoteUuid }) => `/show-vote/${showVoteUuid}/voter`,
  },
  getVoter: {
    method: "GET", params: ["showVoteUuid", "userRef"], body: [],
    description: "Returns the voter reference and contact details, remaining points, fraud status, and balance breakdown.",
    response: "GetVoterResponse",
    path: ({ showVoteUuid, userRef }) => `/show-vote/${showVoteUuid}/voter/${userRef}`,
  },
  addVote: {
    method: "POST", params: ["showVoteUuid", "userRef"], body: ["additionalVoteType", "nbPoints"],
    description: "Credits additional votes and returns the operation result, including nbVoteRemaining when provided by the API.",
    response: "OperationResult",
    path: ({ showVoteUuid, userRef }) => `/show-vote/${showVoteUuid}/voter/${userRef}/add-vote`,
  },
  castVote: {
    method: "POST", params: ["showVoteUuid", "userRef"],
    body: ["votes", "sessionToken", "phoneFingerPrint", "ip", "userAgent", "uniqSubscriptionId"],
    requiredBody: ["votes"],
    description: "Casts votes for participants in the current round and returns the operation result, including nbVoteRemaining when provided by the API.",
    response: "OperationResult",
    path: ({ showVoteUuid, userRef }) => `/show-vote/${showVoteUuid}/voter/${userRef}/vote`,
  },
};

const catalog = Object.fromEntries(
  Object.entries(modes).map(([name, { path: _path, ...info }]) => [name, info]),
);

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validVote(value: unknown): boolean {
  return isObject(value) && typeof value.choiceUuid === "string" && !!value.choiceUuid.trim()
    && typeof value.nbVotes === "number" && Number.isInteger(value.nbVotes) && value.nbVotes > 0;
}

async function parseParams(req: Request, url: URL, action: Mode, mode: string) {
  if (req.method !== action.method) {
    throw new InputError(`Mode ${mode} requires ${action.method}.`, 405, { Allow: `${action.method}, OPTIONS` });
  }
  const params: PathParams = {};
  for (const key of action.params) {
    const value = url.searchParams.get(key);
    if (!value?.trim()) throw new InputError(`Required query parameter: ${key}.`);
    params[key] = encodeURIComponent(value);
  }
  let body: JsonObject | undefined;
  if (action.method === "POST") {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
      throw new InputError("The request body must use application/json.", 415);
    }
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      throw new InputError("Invalid JSON body.");
    }
    if (!isObject(parsed)) throw new InputError("The request body must be a JSON object.");
    body = parsed;
    const unknown = Object.keys(body).filter((key) => !action.body.includes(key));
    if (unknown.length) throw new InputError(`Unknown body fields: ${unknown.join(", ")}.`);
    if (mode === "castVote" && (!Array.isArray(body.votes) || !body.votes.length || !body.votes.every(validVote))) {
      throw new InputError("votes must contain at least one object with choiceUuid and a positive integer nbVotes.");
    }
  }
  return { params, body };
}

function upstreamUrl(baseUrl: string, path: string): URL {
  const url = new URL(baseUrl.replace(/\/+$/, "") + path);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid DVLIVE_BASE_URL.");
  }
  return url;
}

export function createHandler({ env }: HandlerOptions) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    try {
      const url = new URL(req.url);
      const mode = url.searchParams.get("mode");
      if (!mode) {
        if (req.method !== "GET") {
          throw new InputError("Use GET to retrieve the mode catalog.", 405, { Allow: "GET, OPTIONS" });
        }
        return json({
          name: "DVLive",
          description: "Select a mode in the URL query. Required params must be passed in the query; body fields must be sent as JSON in POST requests. Pass the DV Live token in the bearer-token header.",
          modes: catalog,
        });
      }
      if (!Object.hasOwn(modes, mode)) {
        return json({ status: "error", code: 400, message: "Unknown mode.", modes: catalog }, 400);
      }
      const action = modes[mode];
      const { params, body } = await parseParams(req, url, action, mode);
      const token = req.headers.get("bearer-token")?.trim();
      if (!token) throw new InputError("The bearer-token header is required (DV Live token without the Bearer prefix).", 401);
      const baseUrl = env("DVLIVE_BASE_URL");
      if (!baseUrl) return error(500, "Configure DVLIVE_BASE_URL on the server.");
      let upstream: URL;
      try {
        upstream = upstreamUrl(baseUrl, action.path(params));
      } catch {
        return error(500, "Invalid DVLIVE_BASE_URL.");
      }
      try {
        const response = await fetch(upstream, {
          method: action.method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        const headers: Record<string, string> = {
          ...CORS_HEADERS,
          "Content-Type": response.headers.get("content-type") ?? "application/json",
        };
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) headers["Retry-After"] = retryAfter;
        return new Response(response.body, { status: response.status, headers });
      } catch (err) {
        return err instanceof Error && err.name === "TimeoutError"
          ? error(504, "DV Live API request timed out.")
          : error(502, "DV Live API is unreachable.");
      }
    } catch (err) {
      if (err instanceof InputError) return error(err.status, err.message, err.headers);
      return error(500, "Internal DVLive error.");
    }
  };
}

export const handleRequest = createHandler({ env: (name) => Deno.env.get(name) });

if (typeof Deno !== "undefined") {
  Deno.serve(handleRequest);
}
