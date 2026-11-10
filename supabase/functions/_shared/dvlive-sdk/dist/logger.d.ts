export type LogLevel = "WARNING" | "INFO" | "DEBUG";
/** Instance-local logging: no environment reads and no shared mutable state. */
export declare class DvLiveLogger {
    private readonly enabled;
    private readonly level;
    constructor(enable?: boolean | string, level?: string);
    write(level: LogLevel, event: string, details: Record<string, unknown>, secrets?: readonly string[]): void;
}
//# sourceMappingURL=logger.d.ts.map