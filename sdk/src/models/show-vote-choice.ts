export interface EliminatedRoundResponse {
  uuid: string;
  round: number;
}

export interface ReintroducedRoundResponse {
  uuid: string;
  round: number;
}

/** A choice in the current round. */
export interface ChoiceResponse {
  uuid: string;
  firstname: string;
  lastname: string;
  bio?: string | null;
  desktopPicture?: string | null;
  mobilePicture?: string | null;
}

/** Full participant details returned by /show-vote-choice/{uuid}. */
export interface ShowVoteChoiceResponse extends ChoiceResponse {
  showVoteUuid: string;
  status: string;
  order: number;
  eliminatedRound?: EliminatedRoundResponse | null;
  reintroducedRound?: ReintroducedRoundResponse | null;
}
