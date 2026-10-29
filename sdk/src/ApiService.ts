import { ShowVoteResponse } from "./responses/show-vote.ts";
import { ShowVoteChoiceResponse } from "./responses/show-vote-choice.ts";
import { GetVoterResponse, CreateVoterResponse, AddVoteResponse, CastVoteResponse } from "./responses/voter.ts";
import { ApiHttpError, ApiRequestError, ApiResponseError } from "./ApiErrors.ts";
import { resolveBaseUrl } from "./environment.ts";
import { ApiResponse } from "./models/api-response.ts";
import { ShowVote } from "./models/show-vote.ts";
import { ShowVoteChoice } from "./models/show-vote-choice.ts";
import { AddVoteResult, CastVoteResult, CreateVoterResult, Voter } from "./models/voter.ts";
import { GetVoterRequest, AddVoteRequest, CastVoteRequest, CreateVoterRequest, CreateVoterBody, AddVoteBody, CastVoteBody } from "./requests/voter.ts";
import { GetShowVoteRequest } from "./requests/show-vote.ts";
import { GetShowVoteChoiceRequest } from "./requests/show-vote-choice.ts";
import type { GetVoterInput, CreateVoterInput, AddVoteInput, CastVoteInput } from "./requests/voter.ts";

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

  async getShowVote(uuid: string): Promise<ApiResponse<ShowVote>> {
    const request = new GetShowVoteRequest(uuid);
    const response = await this.request("GET", `/show-vote/${encodeURIComponent(request.uuid)}`);
    try {
      const decoded = ShowVoteResponse.decode(response.data);
      return new ApiResponse(ShowVote.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async getShowVoteChoice(uuid: string): Promise<ApiResponse<ShowVoteChoice>> {
    const request = new GetShowVoteChoiceRequest(uuid);
    const response = await this.request("GET", `/show-vote-choice/${encodeURIComponent(request.uuid)}`);
    try {
      const decoded = ShowVoteChoiceResponse.decode(response.data);
      return new ApiResponse(ShowVoteChoice.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async createVoter(...args: [input: CreateVoterInput] | [input: Pick<CreateVoterInput, "showVoteUuid">, body: unknown]): Promise<ApiResponse<CreateVoterResult>> {
    const [input, ...body] = args;
    const request = new CreateVoterRequest(input?.showVoteUuid, CreateVoterBody.decode(body.length === 0 ? input : body[0]));
    const response = await this.request("POST", this.voterPath(request.showVoteUuid), request.body);
    try {
      const decoded = CreateVoterResponse.decode(response.data);
      return new ApiResponse(CreateVoterResult.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async getVoter(input: GetVoterInput): Promise<ApiResponse<Voter>> {
    const request = new GetVoterRequest(input?.showVoteUuid, input?.userRef);
    const response = await this.request("GET", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}`);
    try {
      const decoded = GetVoterResponse.decode(response.data);
      return new ApiResponse(Voter.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async addVote(...args: [input: AddVoteInput] | [input: Pick<AddVoteInput, "showVoteUuid" | "userRef">, body: unknown]): Promise<ApiResponse<AddVoteResult>> {
    const [input, ...body] = args;
    const request = new AddVoteRequest(input?.showVoteUuid, input?.userRef, AddVoteBody.decode(body.length === 0 ? input : body[0]));
    const response = await this.request("POST", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}/add-vote`, request.body);
    try {
      const decoded = AddVoteResponse.decode(response.data);
      return new ApiResponse(AddVoteResult.fromResponse(decoded), response.status, response.headers);
    } catch (cause) {
      throw new ApiResponseError(response, response.bodyText, cause);
    }
  }

  async castVote(...args: [input: CastVoteInput] | [input: Pick<CastVoteInput, "showVoteUuid" | "userRef">, body: unknown]): Promise<ApiResponse<CastVoteResult>> {
    const [input, ...body] = args;
    const request = new CastVoteRequest(input?.showVoteUuid, input?.userRef, CastVoteBody.decode(body.length === 0 ? input : body[0]));
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
