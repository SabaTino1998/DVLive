import { ChoiceResponse } from "./show-vote-choice.ts";
/** Decoded DV Live wire models. Each class owns its validation. */
export declare class RoundResponse {
    readonly currentRound: number;
    readonly startDay: string;
    readonly endDay: string;
    readonly name: string;
    readonly choices: ChoiceResponse[];
    constructor(currentRound: number, startDay: string, endDay: string, name: string, choices: ChoiceResponse[]);
    static decode(value: unknown, path?: string): RoundResponse;
}
export declare class ShowVoteResponse {
    readonly name: string;
    readonly startDate: string;
    readonly endDate: string;
    round?: RoundResponse | null;
    constructor(name: string, startDate: string, endDate: string);
    static decode(value: unknown, path?: string): ShowVoteResponse;
}
//# sourceMappingURL=show-vote.d.ts.map