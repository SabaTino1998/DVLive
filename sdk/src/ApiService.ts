import { ShowVoteResponse } from "./responses/show-vote.ts";
import { ShowVoteChoiceResponse } from "./responses/show-vote-choice.ts";
import { GetVoterResponse, CreateVoterResponse, AddVoteResponse, CastVoteResponse } from "./responses/voter.ts";
import { ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError } from "./ApiErrors.ts";
import { resolveBaseUrl } from "./environment.ts";
import { ApiResponse } from "./models/api-response.ts";
import { ShowVote } from "./models/show-vote.ts";
import { ShowVoteChoice } from "./models/show-vote-choice.ts";
import {
  AddVoteResult, CastVoteResult, CreateVoterResult, Voter,
} from "./models/voter.ts";
import { GetVoterRequest, AddVoteRequest, CastVoteRequest, CreateVoterRequest } from "./requests/voter.ts";

import { GetShowVoteRequest } from "./requests/show-vote.ts";
import { GetShowVoteChoiceRequest } from "./requests/show-vote-choice.ts";

interface HttpResponse extends ApiResponse<unknown> {
  bodyText: string;
}

export interface ApiServiceConfig {
  environment: string | undefined;
  headers?: Record<string, string> | (() => Record<string, string>);
  timeoutMs?: number;
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

  async getShowVote(request: GetShowVoteRequest): Promise<ApiResponse<ShowVote>> {
    if (!(request instanceof GetShowVoteRequest)) throw new ApiValidationError("request must be a GetShowVoteRequest.");
    const response = await this.request("GET", `/show-vote/${encodeURIComponent(request.uuid)}`);
    try {
      const decoded = ShowVoteResponse.decode(response.data);
      return new ApiResponse(ShowVote.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async getShowVoteChoice(request: GetShowVoteChoiceRequest): Promise<ApiResponse<ShowVoteChoice>> {
    if (!(request instanceof GetShowVoteChoiceRequest)) throw new ApiValidationError("request must be a GetShowVoteChoiceRequest.");
    const response = await this.request("GET", `/show-vote-choice/${encodeURIComponent(request.uuid)}`);
    try {
      const decoded = ShowVoteChoiceResponse.decode(response.data);
      return new ApiResponse(ShowVoteChoice.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async createVoter(request: CreateVoterRequest): Promise<ApiResponse<CreateVoterResult>> {
    if (!(request instanceof CreateVoterRequest)) throw new ApiValidationError("request must be a CreateVoterRequest.");
    const response = await this.request("POST", this.voterPath(request.showVoteUuid), request.body);
    try {
      const decoded = CreateVoterResponse.decode(response.data);
      return new ApiResponse(CreateVoterResult.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async getVoter(request: GetVoterRequest): Promise<ApiResponse<Voter>> {
    if (!(request instanceof GetVoterRequest)) throw new ApiValidationError("request must be a GetVoterRequest.");
    const response = await this.request("GET", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}`);
    try {
      const decoded = GetVoterResponse.decode(response.data);
      return new ApiResponse(Voter.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async addVote(request: AddVoteRequest): Promise<ApiResponse<AddVoteResult>> {
    if (!(request instanceof AddVoteRequest)) throw new ApiValidationError("request must be a AddVoteRequest.");
    const response = await this.request("POST", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}/add-vote`, request.body);
    try {
      const decoded = AddVoteResponse.decode(response.data);
      return new ApiResponse(AddVoteResult.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async castVote(request: CastVoteRequest): Promise<ApiResponse<CastVoteResult>> {
    if (!(request instanceof CastVoteRequest)) throw new ApiValidationError("request must be a CastVoteRequest.");
    const response = await this.request("POST", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}/vote`, request.body);
    try {
      const decoded = CastVoteResponse.decode(response.data);
      return new ApiResponse(CastVoteResult.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  private voterPath(showVoteUuid: string): string {
    return `/show-vote/${encodeURIComponent(showVoteUuid)}/voter`;
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<HttpResponse> {
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
    try {
      document = JSON.parse(text);
    } catch (cause) {
      if (response.ok) throw new ApiResponseError(response, text, cause);
      // Preserve non-JSON error responses unchanged.
    }
    if (!response.ok) throw new ApiHttpError(response, text, document);
    return { data: document, status: response.status, headers: new Headers(response.headers), bodyText: text };
  }
}
