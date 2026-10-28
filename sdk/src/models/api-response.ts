/** Decoded upstream data and the original HTTP response metadata. */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}
