/** Supported operations. Values match the public mode query parameter. */
export declare enum ApiModes {
    GetShowVoteChoice = "getShowVoteChoice",
    GetShowVote = "getShowVote",
    CreateVoter = "createVoter",
    GetVoter = "getVoter",
    CastVote = "castVote"
}
export interface ApiModeDefinition {
    readonly method: "GET" | "POST";
    /** Required URL query parameters, excluding mode itself. */
    readonly params: readonly string[];
    /** Supported JSON body fields. */
    readonly body: readonly string[];
    readonly requiredBody?: readonly string[];
    readonly description: string;
    readonly response: string;
}
export declare const API_MODES: Readonly<Record<ApiModes, ApiModeDefinition>>;
export interface ModeCatalog {
    name: "DVLive";
    description: string;
    modes: Readonly<Record<ApiModes, ApiModeDefinition>>;
}
export type ModeParseResult = {
    mode: ApiModes;
    catalog: null;
} | {
    mode: null;
    catalog: ModeCatalog;
};
export declare function getModeCatalog(): ModeCatalog;
/** Exact, case-sensitive parsing. Missing or unsupported modes return the catalog. */
export declare function parseMode(value: string | null | undefined): ModeParseResult;
//# sourceMappingURL=ApiModes.d.ts.map