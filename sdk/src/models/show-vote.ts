import type { ChoiceResponse } from "./show-vote-choice.ts";

export interface RoundResponse {
  currentRound: number;
  startDay: string;
  endDay: string;
  name: string;
  choices: ChoiceResponse[];
}

export interface ShowVoteResponse {
  name: string;
  startDate: string;
  endDate: string;
  round?: RoundResponse | null;
}
