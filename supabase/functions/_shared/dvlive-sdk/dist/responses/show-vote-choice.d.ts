export type ChoiceStatusResponse = "EVICTED" | "PRESENT";
/** Decoded DV Live wire models. Each class owns its validation. */
export declare class EliminatedRoundResponse {
    readonly uuid: string;
    readonly round: number;
    constructor(uuid: string, round: number);
    static decode(value: unknown, path?: string): EliminatedRoundResponse;
}
export declare class ReintroducedRoundResponse {
    readonly uuid: string;
    readonly round: number;
    constructor(uuid: string, round: number);
    static decode(value: unknown, path?: string): ReintroducedRoundResponse;
}
export declare class ChoiceResponse {
    readonly uuid: string;
    readonly firstname: string;
    readonly lastname: string;
    readonly status: ChoiceStatusResponse;
    isNominated?: boolean;
    bio?: string | null;
    desktopPicture?: string | null;
    mobilePicture?: string | null;
    constructor(uuid: string, firstname: string, lastname: string, status: ChoiceStatusResponse);
    static decode(value: unknown, path?: string): ChoiceResponse;
}
export declare class ShowVoteChoiceResponse {
    readonly uuid: string;
    readonly showVoteUuid: string;
    readonly firstname: string;
    readonly lastname: string;
    readonly status: string;
    readonly order: number;
    isNominated?: boolean;
    bio?: string | null;
    desktopPicture?: string | null;
    mobilePicture?: string | null;
    eliminatedRound?: EliminatedRoundResponse | null;
    reintroducedRound?: ReintroducedRoundResponse | null;
    constructor(uuid: string, showVoteUuid: string, firstname: string, lastname: string, status: string, order: number);
    static decode(value: unknown, path?: string): ShowVoteChoiceResponse;
}
//# sourceMappingURL=show-vote-choice.d.ts.map