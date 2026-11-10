import type { RoundResponse, ShowVoteResponse } from "../responses/show-vote.ts";
import { Choice } from "./show-vote-choice.ts";
/** Public DTOs. Customize field names and transformations in fromResponse(). */
export declare class Round {
    readonly currentRound: number;
    readonly startDay: string;
    readonly endDay: string;
    readonly name: string;
    readonly choices: Choice[];
    constructor(currentRound: number, startDay: string, endDay: string, name: string, choices: Choice[]);
    static fromResponse(response: RoundResponse): Round;
}
export declare class ShowVote {
    readonly name: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly round?: Round | null;
    constructor(name: string, startDate: string, endDate: string, round?: Round | null);
    static fromResponse(response: ShowVoteResponse): ShowVote;
}
//# sourceMappingURL=show-vote.d.ts.map