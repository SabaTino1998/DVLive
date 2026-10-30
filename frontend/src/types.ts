export interface Session { email: string; needsRegistration: boolean }
export interface Choice {
  uuid: string; firstname: string; lastname: string; status: string;
  bio?: string | null; desktopPicture?: string | null; mobilePicture?: string | null;
}
export interface ChoiceDetail extends Choice {
  showVoteUuid: string; order: number;
  eliminatedRound?: { uuid: string; round: number } | null;
  reintroducedRound?: { uuid: string; round: number } | null;
}
export interface Show {
  name: string; startDate: string; endDate: string;
  round?: { currentRound: number; name: string; startDay: string; endDay: string; choices: Choice[] } | null;
}
export interface Voter {
  remainingPoints: number;
  balance: { standardPoint?: number; additionalPoint?: number; purchasedPoint?: number };
}
