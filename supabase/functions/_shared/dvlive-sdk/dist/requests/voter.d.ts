export declare class CreateVoterBody {
    private readonly validated;
    readonly email?: string;
    readonly phone?: string | null;
    readonly uniqRef?: string;
    constructor(fields?: {
        email?: string;
        phone?: string | null;
        uniqRef?: string;
    });
    static decode(value: unknown): CreateVoterBody;
}
export interface CastVoteChoiceInput {
    choiceUuid: string;
    nbVotes: number;
}
export declare class CastVoteChoiceRequest {
    readonly choiceUuid: string;
    readonly nbVotes: number;
    private readonly validated;
    constructor(choiceUuid: string, nbVotes: number);
    static decode(value: unknown): CastVoteChoiceRequest;
}
interface CastVoteFields {
    votes: readonly CastVoteChoiceRequest[];
    sessionToken?: string;
    phoneFingerPrint?: string;
    ip?: string;
    userAgent?: string;
    uniqSubscriptionId?: string;
}
export declare class CastVoteBody {
    private readonly validated;
    readonly votes: readonly CastVoteChoiceRequest[];
    readonly sessionToken?: string;
    readonly phoneFingerPrint?: string;
    readonly ip?: string;
    readonly userAgent?: string;
    readonly uniqSubscriptionId?: string;
    constructor(fields: CastVoteFields);
    static decode(value: unknown): CastVoteBody;
}
export interface GetVoterInput {
    showVoteUuid: string;
    userRef: string;
}
export declare class GetVoterRequest {
    readonly showVoteUuid: string;
    readonly userRef: string;
    private readonly validated;
    constructor(showVoteUuid: string, userRef: string);
}
export interface CreateVoterInput {
    showVoteUuid: string;
    email?: string;
    phone?: string | null;
    uniqRef?: string;
}
export declare class CreateVoterRequest {
    readonly showVoteUuid: string;
    readonly body: CreateVoterBody;
    private readonly validated;
    constructor(showVoteUuid: string, body: CreateVoterBody);
}
export interface CastVoteInput extends GetVoterInput {
    votes: readonly CastVoteChoiceInput[];
    sessionToken?: string;
    phoneFingerPrint?: string;
    ip?: string;
    userAgent?: string;
    uniqSubscriptionId?: string;
}
export declare class CastVoteRequest {
    readonly showVoteUuid: string;
    readonly userRef: string;
    readonly body: CastVoteBody;
    private readonly validated;
    constructor(showVoteUuid: string, userRef: string, body: CastVoteBody);
}
export {};
//# sourceMappingURL=voter.d.ts.map