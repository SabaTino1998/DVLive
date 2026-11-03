import { ChoiceResponse } from "./show-vote-choice.js";
import { array, integer, nullable, object, string } from "./decoding.js";
/** Decoded DV Live wire models. Each class owns its validation. */
export class RoundResponse {
    currentRound;
    startDay;
    endDay;
    name;
    choices;
    constructor(currentRound, startDay, endDay, name, choices) {
        this.currentRound = currentRound;
        this.startDay = startDay;
        this.endDay = endDay;
        this.name = name;
        this.choices = choices;
    }
    static decode(value, path = "RoundResponse") {
        const source = object(value, path);
        const response = new RoundResponse(integer(source.currentRound, `${path}.currentRound`), string(source.startDay, `${path}.startDay`), string(source.endDay, `${path}.endDay`), string(source.name, `${path}.name`), array(source.choices, ChoiceResponse.decode, `${path}.choices`));
        return response;
    }
}
export class ShowVoteResponse {
    name;
    startDate;
    endDate;
    constructor(name, startDate, endDate) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
    }
    static decode(value, path = "ShowVoteResponse") {
        const source = object(value, path);
        const response = new ShowVoteResponse(string(source.name, `${path}.name`), string(source.startDate, `${path}.startDate`), string(source.endDate, `${path}.endDate`));
        if (source.round !== undefined)
            response.round = nullable(source.round, RoundResponse.decode, `${path}.round`);
        return response;
    }
}
//# sourceMappingURL=show-vote.js.map