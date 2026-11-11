import { ShowVoteResponse } from "./responses/show-vote.js";
import { ShowVoteChoiceResponse } from "./responses/show-vote-choice.js";
import { GetVoterResponse, CreateVoterResponse, CastVoteResponse } from "./responses/voter.js";
import { ApiHttpError, ApiRequestError, ApiResponseError } from "./ApiErrors.js";
import { resolveBaseUrl } from "./environment.js";
import { ApiResponse } from "./models/api-response.js";
import { ShowVote } from "./models/show-vote.js";
import { ShowVoteChoice } from "./models/show-vote-choice.js";
import { CastVoteResult, CreateVoterResult, Voter } from "./models/voter.js";
import { GetVoterRequest, CastVoteRequest, CreateVoterRequest, CreateVoterBody, CastVoteBody } from "./requests/voter.js";
import { GetShowVoteRequest } from "./requests/show-vote.js";
import { GetShowVoteChoiceRequest } from "./requests/show-vote-choice.js";
import { DvLiveLogger } from "./logger.js";
export class ApiService {
    url;
    extraHeaders;
    timeoutMs;
    logger;
    constructor(config) {
        this.url = resolveBaseUrl(config.environment, config.mode);
        this.logger = new DvLiveLogger(config.logEnable, config.logLevel);
        this.extraHeaders = config.headers;
        this.timeoutMs = config.timeoutMs ?? 15000;
        if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2147483647) {
            throw new TypeError("timeoutMs must be a positive 32-bit integer.");
        }
    }
    async getShowVote(uuid) {
        const request = new GetShowVoteRequest(uuid);
        const response = await this.request("getShowVote", "GET", `/show-vote/${encodeURIComponent(request.uuid)}`);
        try {
            const decoded = ShowVoteResponse.decode(response.data);
            return new ApiResponse(ShowVote.fromResponse(decoded), response.status, response.headers);
        }
        catch (cause) {
            this.logger.write("WARNING", "Response decoding failed", { operation: "getShowVote", status: response.status });
            throw new ApiResponseError(response, response.bodyText, cause);
        }
    }
    async getShowVoteChoice(uuid) {
        const request = new GetShowVoteChoiceRequest(uuid);
        const response = await this.request("getShowVoteChoice", "GET", `/show-vote-choice/${encodeURIComponent(request.uuid)}`);
        try {
            const decoded = ShowVoteChoiceResponse.decode(response.data);
            return new ApiResponse(ShowVoteChoice.fromResponse(decoded), response.status, response.headers);
        }
        catch (cause) {
            this.logger.write("WARNING", "Response decoding failed", { operation: "getShowVoteChoice", status: response.status });
            throw new ApiResponseError(response, response.bodyText, cause);
        }
    }
    async createVoter(...args) {
        const [input, ...body] = args;
        const request = new CreateVoterRequest(input?.showVoteUuid, CreateVoterBody.decode(body.length === 0 ? input : body[0]));
        const response = await this.request("createVoter", "POST", this.voterPath(request.showVoteUuid), request.body);
        try {
            const decoded = CreateVoterResponse.decode(response.data);
            return new ApiResponse(CreateVoterResult.fromResponse(decoded), response.status, response.headers);
        }
        catch (cause) {
            this.logger.write("WARNING", "Response decoding failed", { operation: "createVoter", status: response.status });
            throw new ApiResponseError(response, response.bodyText, cause);
        }
    }
    async getVoter(input) {
        const request = new GetVoterRequest(input?.showVoteUuid, input?.userRef);
        const response = await this.request("getVoter", "GET", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}`);
        try {
            const decoded = GetVoterResponse.decode(response.data);
            return new ApiResponse(Voter.fromResponse(decoded), response.status, response.headers);
        }
        catch (cause) {
            this.logger.write("WARNING", "Response decoding failed", { operation: "getVoter", status: response.status });
            throw new ApiResponseError(response, response.bodyText, cause);
        }
    }
    async castVote(...args) {
        const [input, ...body] = args;
        const request = new CastVoteRequest(input?.showVoteUuid, input?.userRef, CastVoteBody.decode(body.length === 0 ? input : body[0]));
        const response = await this.request("castVote", "POST", `${this.voterPath(request.showVoteUuid)}/${encodeURIComponent(request.userRef)}/vote`, request.body);
        try {
            const decoded = CastVoteResponse.decode(response.data);
            return new ApiResponse(CastVoteResult.fromResponse(decoded), response.status, response.headers);
        }
        catch (cause) {
            this.logger.write("WARNING", "Response decoding failed", { operation: "castVote", status: response.status });
            throw new ApiResponseError(response, response.bodyText, cause);
        }
    }
    voterPath(showVoteUuid) {
        return `/show-vote/${encodeURIComponent(showVoteUuid)}/voter`;
    }
    async request(operation, method, path, body) {
        const extra = typeof this.extraHeaders === "function" ? this.extraHeaders() : this.extraHeaders;
        const headers = new Headers({
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        });
        new Headers(extra).forEach((value, key) => headers.set(key, value));
        const requestBody = body === undefined ? undefined : JSON.stringify(body);
        const signal = AbortSignal.timeout(this.timeoutMs);
        const started = Date.now();
        const secrets = [];
        headers.forEach((value, key) => {
            if (/authorization|token|key|x-internal-auth/i.test(key))
                secrets.push(value, value.replace(/^Bearer\s+/i, ""));
        });
        const voterRef = path.match(/\/voter\/([^/]+)/)?.[1];
        if (voterRef)
            secrets.push(voterRef, decodeURIComponent(voterRef));
        const context = { operation, method, url: this.url + path.replace(/(\/voter\/)[^/]+/, "$1[REDACTED]") };
        this.logger.write("INFO", "Request started", context, secrets);
        this.logger.write("DEBUG", "Request details", { ...context, body }, secrets);
        let response;
        let text;
        try {
            response = await fetch(new URL(this.url + path), {
                method, headers, body: requestBody, signal, redirect: "error",
            });
            // Keep body reading inside the timeout/network boundary as well.
            text = await response.text();
        }
        catch (cause) {
            const timedOut = signal.aborted || (cause instanceof Error && cause.name === "TimeoutError");
            this.logger.write("WARNING", timedOut ? "Request timed out" : "Network request failed", {
                ...context, durationMs: Date.now() - started,
            }, secrets);
            throw new ApiRequestError(timedOut ? "timeout" : "network", cause);
        }
        const result = { ...context, status: response.status, durationMs: Date.now() - started };
        this.logger.write("INFO", "HTTP response received", result, secrets);
        let document;
        try {
            document = JSON.parse(text);
        }
        catch (cause) {
            if (response.ok) {
                this.logger.write("WARNING", "Response is not valid JSON", result, secrets);
                throw new ApiResponseError(response, text, cause);
            }
            // Preserve non-JSON error responses unchanged.
        }
        this.logger.write("DEBUG", "Response details", { ...result, body: document ?? "[Non-JSON body omitted]" }, secrets);
        if (!response.ok) {
            this.logger.write("WARNING", "HTTP request failed", result, secrets);
            throw new ApiHttpError(response, text, document);
        }
        return { data: document, status: response.status, headers: new Headers(response.headers), bodyText: text };
    }
}
//# sourceMappingURL=ApiService.js.map