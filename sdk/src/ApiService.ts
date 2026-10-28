import { ApiHttpError, ApiRequestError, ApiResponseError } from "./errors.ts";
import { resolveBaseUrl, type ApiEnvironment } from "./environment.ts";
import { validateCreateVoter, validateAddVote, validateCastVote } from "./validation.ts";
import type { ApiResponse } from "./models/api-response.ts";
import type { ShowVoteResponse } from "./models/show-vote.ts";
import type { ShowVoteChoiceResponse } from "./models/show-vote-choice.ts";
import type {
  AddVoteRequest, AddVoteResponse, CastVoteRequest, CastVoteResponse,
  CreateVoterRequest, CreateVoterResponse, GetVoterResponse,
} from "./models/voter.ts";

export interface ApiServiceConfig {
  environment: ApiEnvironment;
  headers?: Record<string, string> | (() => Record<string, string>);
  timeoutMs?: number;
}

function pathParameter(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim() || value === "." || value === "..") {
    throw new TypeError(`${name} must be a non-empty path parameter.`);
  }
  return encodeURIComponent(value);
}

export class ApiService {
  private readonly url: string;
  private readonly extraHeaders: ApiServiceConfig["headers"];
  private readonly timeoutMs: number;

  constructor(config: ApiServiceConfig) {
    this.url = resolveBaseUrl(config.environment);
    this.extraHeaders = config.headers;
    this.timeoutMs = config.timeoutMs ?? 15000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2147483647) {
      throw new TypeError("timeoutMs must be a positive 32-bit integer.");
    }
  }

  getShowVote(uuid: string): Promise<ApiResponse<ShowVoteResponse>> {
    return this.request("GET", `/show-vote/${pathParameter(uuid, "uuid")}`);
  }

  getShowVoteChoice(uuid: string): Promise<ApiResponse<ShowVoteChoiceResponse>> {
    return this.request("GET", `/show-vote-choice/${pathParameter(uuid, "uuid")}`);
  }

  createVoter(showVoteUuid: string, body: CreateVoterRequest): Promise<ApiResponse<CreateVoterResponse>> {
    validateCreateVoter(body);
    return this.request("POST", this.voterPath(showVoteUuid), body);
  }

  getVoter(showVoteUuid: string, userRef: string): Promise<ApiResponse<GetVoterResponse>> {
    return this.request("GET", `${this.voterPath(showVoteUuid)}/${pathParameter(userRef, "userRef")}`);
  }

  addVote(showVoteUuid: string, userRef: string, body: AddVoteRequest): Promise<ApiResponse<AddVoteResponse>> {
    validateAddVote(body);
    return this.request("POST", `${this.voterPath(showVoteUuid)}/${pathParameter(userRef, "userRef")}/add-vote`, body);
  }

  castVote(showVoteUuid: string, userRef: string, body: CastVoteRequest): Promise<ApiResponse<CastVoteResponse>> {
    validateCastVote(body);
    return this.request("POST", `${this.voterPath(showVoteUuid)}/${pathParameter(userRef, "userRef")}/vote`, body);
  }

  private voterPath(showVoteUuid: string): string {
    return `/show-vote/${pathParameter(showVoteUuid, "showVoteUuid")}/voter`;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResponse<T>> {
    const extra = typeof this.extraHeaders === "function" ? this.extraHeaders() : this.extraHeaders;
    const headers = new Headers({ Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) });
    new Headers(extra).forEach((value, key) => headers.set(key, value));
    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await fetch(new URL(this.url + path), {
        method, headers, body: requestBody, signal, redirect: "error",
      });
      // Keep body reading inside the timeout/network boundary as well.
      text = await response.text();
    } catch (cause) {
      const timedOut = signal.aborted || (cause instanceof Error && cause.name === "TimeoutError");
      throw new ApiRequestError(timedOut ? "timeout" : "network", cause);
    }
    let document: unknown;
    try { document = JSON.parse(text); } catch { /* Preserve non-JSON errors as raw text. */ }
    if (!response.ok) throw new ApiHttpError(response, text, document);
    if (document === null || typeof document !== "object" || Array.isArray(document)) {
      throw new ApiResponseError(response, text);
    }
    // Interfaces describe the upstream contract; this is not full schema validation.
    return { data: document as T, status: response.status, headers: new Headers(response.headers) };
  }
}
