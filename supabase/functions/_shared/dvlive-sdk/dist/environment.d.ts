export type AlbTokenSlot = "dev" | "stag" | "prod";
export declare function resolveBaseUrl(environment: string | undefined): string;
/** Returns the ALB token slot for a request host, or undefined when the host is unknown. */
export declare function resolveAlbTokenSlot(hostname: string): AlbTokenSlot | undefined;
//# sourceMappingURL=environment.d.ts.map