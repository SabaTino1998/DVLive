/** Unknown JSON is handled only at the decoding boundary. Extra fields are ignored. */
export declare function bodyObject(value: unknown): Record<string, unknown>;
export declare function string(value: unknown, name: string): string;
export declare function optionalString(value: unknown, name: string): string | undefined;
export declare function optionalPhone(value: unknown): string | null | undefined;
export declare function number(value: unknown, name: string): number;
//# sourceMappingURL=body-decoding.d.ts.map