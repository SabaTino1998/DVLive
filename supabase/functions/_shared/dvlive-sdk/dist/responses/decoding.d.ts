/** Small decoding primitives; endpoint decoders select fields explicitly. */
export declare function object(value: unknown, path: string): Record<string, unknown>;
export declare function string(value: unknown, path: string): string;
export declare function boolean(value: unknown, path: string): boolean;
export declare function integer(value: unknown, path: string): number;
export declare function nullable<T>(value: unknown, decode: (value: unknown, path: string) => T, path: string): T | null;
export declare function array<T>(value: unknown, decode: (value: unknown, path: string) => T, path: string): T[];
//# sourceMappingURL=decoding.d.ts.map