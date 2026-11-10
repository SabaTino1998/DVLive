export type UserFraudStatusResponse = "CLEAN" | "SUSPICIOUS" | "BLOCKED" | "VERIFIED";
/** Decoded DV Live wire models. Each class owns its validation. */
export declare class VoterBalanceResponse {
    standardPoint?: number;
    additionalPoint?: number;
    purchasedPoint?: number;
    static decode(value: unknown, path?: string): VoterBalanceResponse;
}
export declare class GetVoterResponse {
    readonly uniqRef: string;
    readonly remainingPoints: number;
    readonly userFraudStatus: UserFraudStatusResponse;
    readonly balance: VoterBalanceResponse;
    email?: string | null;
    phone?: string | null;
    constructor(uniqRef: string, remainingPoints: number, userFraudStatus: UserFraudStatusResponse, balance: VoterBalanceResponse);
    static decode(value: unknown, path?: string): GetVoterResponse;
}
export declare class CreateVoterResponse {
    readonly status: "success";
    readonly code: number;
    readonly message: string;
    constructor(status: "success", code: number, message: string);
    static decode(value: unknown, path?: string): CreateVoterResponse;
}
export declare class CastVoteResponse {
    readonly status: "success";
    readonly code: number;
    readonly message: string;
    readonly nbVoteRemaining: number;
    constructor(status: "success", code: number, message: string, nbVoteRemaining: number);
    static decode(value: unknown, path?: string): CastVoteResponse;
}
//# sourceMappingURL=voter.d.ts.map