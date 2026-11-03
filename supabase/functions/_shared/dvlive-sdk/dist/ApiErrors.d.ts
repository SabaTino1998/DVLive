/** Invalid request parameter or body. No upstream HTTP request has been made. */
export declare class ApiValidationError extends Error {
    constructor(message: string);
}
/** Failed upstream HTTP response, including JSON and non-JSON bodies. */
export declare class ApiHttpError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly document: unknown;
    readonly bodyText: string;
    constructor(response: Response, bodyText: string, document?: unknown);
}
export declare class ApiRequestError extends Error {
    readonly kind: "network" | "timeout";
    constructor(kind: "network" | "timeout", cause: unknown);
}
/** A successful HTTP response could not be decoded into its response contract. */
export declare class ApiResponseError extends Error {
    readonly status: number;
    readonly headers: Headers;
    readonly bodyText: string;
    constructor(response: Pick<Response, "status" | "headers">, bodyText: string, cause?: unknown);
}
//# sourceMappingURL=ApiErrors.d.ts.map