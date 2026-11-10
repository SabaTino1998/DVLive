/** Public DTO data and the original HTTP response metadata. */
export declare class ApiResponse<T> {
    readonly data: T;
    readonly status: number;
    readonly headers: Headers;
    constructor(data: T, status: number, headers: Headers);
}
//# sourceMappingURL=api-response.d.ts.map