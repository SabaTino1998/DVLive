import { Choice } from "./show-vote-choice.js";
/** Public DTOs. Customize field names and transformations in fromResponse(). */
export class Round {
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
    static fromResponse(response) {
        return new Round(response.currentRound, response.startDay, response.endDay, response.name, response.choices.map(Choice.fromResponse));
    }
}
export class ShowVote {
    name;
    startDate;
    endDate;
    constructor(name, startDate, endDate, round) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        if (round !== undefined)
            this.round = round;
    }
    static fromResponse(response) {
        return new ShowVote(response.name, response.startDate, response.endDate, response.round == null ? response.round : Round.fromResponse(response.round));
    }
}
//# sourceMappingURL=show-vote.js.map