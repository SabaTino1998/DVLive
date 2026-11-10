/** Invalid request parameter or body. No upstream HTTP request has been made. */
export class ApiValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ApiValidationError";
    }
}
/** Failed upstream HTTP response, including JSON and non-JSON bodies. */
export class ApiHttpError extends Error {
    status;
    statusText;
    headers;
    document;
    bodyText;
    constructor(response, bodyText, document) {
        super(`HTTP ${response.status}: ${response.statusText}`);
        this.name = "ApiHttpError";
        this.status = response.status;
        this.statusText = response.statusText;
        this.headers = new Headers(response.headers);
        this.document = document;
        this.bodyText = bodyText;
    }
}
export class ApiRequestError extends Error {
    kind;
    constructor(kind, cause) {
        super(kind === "timeout" ? "DV Live API request timed out." : "DV Live API is unreachable.", { cause });
        this.name = "ApiRequestError";
        this.kind = kind;
    }
}
/** A successful HTTP response could not be decoded into its response contract. */
export class ApiResponseError extends Error {
    status;
    headers;
    bodyText;
    constructor(response, bodyText, cause) {
        super("DV Live API returned an invalid JSON response.", { cause });
        this.name = "ApiResponseError";
        this.status = response.status;
        this.headers = new Headers(response.headers);
        this.bodyText = bodyText;
    }
}
//# sourceMappingURL=ApiErrors.js.map