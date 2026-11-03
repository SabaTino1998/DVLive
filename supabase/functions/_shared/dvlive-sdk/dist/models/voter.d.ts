import type { CastVoteResponse, CreateVoterResponse, GetVoterResponse, VoterBalanceResponse } from "../responses/voter.ts";
export type UserFraudStatus = "CLEAN" | "SUSPICIOUS" | "BLOCKED" | "VERIFIED";
/** Public DTOs. Customize field names and transformations in fromResponse(). */
export declare class OperationResult {
    readonly status: "success" | "error";
    readonly code: number;
    readonly message: string;
    constructor(status: "success" | "error", code: number, message: string);
    static fromResponse(response: CreateVoterResponse | CastVoteResponse): OperationResult;
}
export declare class CreateVoterResult {
    readonly status: "success";
    readonly code: number;
    readonly message: string;
    constructor(status: "success", code: number, message: string);
    static fromResponse(response: CreateVoterResponse): CreateVoterResult;
}
export declare class CastVoteResult {
    readonly status: "success";
    readonly code: number;
    readonly message: string;
    readonly nbVoteRemaining: number;
    constructor(status: "success", code: number, message: string, nbVoteRemaining: number);
    static fromResponse(response: CastVoteResponse): CastVoteResult;
}
export declare class VoterBalance {
    readonly standardPoint?: number;
    readonly additionalPoint?: number;
    readonly purchasedPoint?: number;
    constructor(standardPoint?: number, additionalPoint?: number, purchasedPoint?: number);
    static fromResponse(response: VoterBalanceResponse): VoterBalance;
}
export declare class Voter {
    readonly uniqRef: string;
    readonly remainingPoints: number;
    readonly userFraudStatus: UserFraudStatus;
    readonly balance: VoterBalance;
    readonly email?: string | null;
    readonly phone?: string | null;
    constructor(uniqRef: string, remainingPoints: number, userFraudStatus: UserFraudStatus, balance: VoterBalance, email?: string | null, phone?: string | null);
    static fromResponse(response: GetVoterResponse): Voter;
}
//# sourceMappingURL=voter.d.ts.map