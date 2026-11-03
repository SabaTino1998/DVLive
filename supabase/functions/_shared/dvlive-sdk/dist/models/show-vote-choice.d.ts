import type { ChoiceStatusResponse, ChoiceResponse, EliminatedRoundResponse, ReintroducedRoundResponse, ShowVoteChoiceResponse } from "../responses/show-vote-choice.ts";
export type ChoiceStatus = ChoiceStatusResponse;
/** Public DTOs. Customize field names and transformations in fromResponse(). */
export declare class EliminatedRound {
    readonly uuid: string;
    readonly round: number;
    constructor(uuid: string, round: number);
    static fromResponse(response: EliminatedRoundResponse): EliminatedRound;
}
export declare class ReintroducedRound {
    readonly uuid: string;
    readonly round: number;
    constructor(uuid: string, round: number);
    static fromResponse(response: ReintroducedRoundResponse): ReintroducedRound;
}
export declare class Choice {
    readonly uuid: string;
    readonly firstname: string;
    readonly lastname: string;
    readonly status: ChoiceStatus;
    readonly bio?: string | null;
    readonly desktopPicture?: string | null;
    readonly mobilePicture?: string | null;
    constructor(uuid: string, firstname: string, lastname: string, status: ChoiceStatus, bio?: string | null, desktopPicture?: string | null, mobilePicture?: string | null);
    static fromResponse(response: ChoiceResponse): Choice;
}
export declare class ShowVoteChoice {
    readonly uuid: string;
    readonly showVoteUuid: string;
    readonly firstname: string;
    readonly lastname: string;
    readonly status: string;
    readonly order: number;
    readonly bio?: string | null;
    readonly desktopPicture?: string | null;
    readonly mobilePicture?: string | null;
    readonly eliminatedRound?: EliminatedRound | null;
    readonly reintroducedRound?: ReintroducedRound | null;
    constructor(uuid: string, showVoteUuid: string, firstname: string, lastname: string, status: string, order: number, bio?: string | null, desktopPicture?: string | null, mobilePicture?: string | null, eliminatedRound?: EliminatedRound | null, reintroducedRound?: ReintroducedRound | null);
    static fromResponse(response: ShowVoteChoiceResponse): ShowVoteChoice;
}
//# sourceMappingURL=show-vote-choice.d.ts.map