/** Public DTO data and the original HTTP response metadata. */
export class ApiResponse {
    data;
    status;
    headers;
    constructor(data, status, headers) {
        this.data = data;
        this.status = status;
        this.headers = headers;
    }
}
//# sourceMappingURL=api-response.js.map