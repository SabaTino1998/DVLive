export type AdditionalVoteType = "PURCHASE" | "SPONSOR" | "VIDEO" | "GAME" | "REFERAL" | "PROMO";
export type UserFraudStatus = "CLEAN" | "SUSPICIOUS" | "BLOCKED" | "VERIFIED";

export interface OperationResult {
  status: "success" | "error";
  code: number;
  message: string;
}

export interface OperationErrorResponse extends OperationResult {
  status: "error";
  nbVoteRemaining?: number | null;
}

export interface AuthenticationErrorResponse {
  authenticated: boolean;
}

export interface CreateVoterRequest {
  email?: string;
  phone?: string | null;
  uniqRef?: string;
}

export interface CreateVoterResponse extends OperationResult {
  status: "success";
}

export interface AddVoteRequest {
  additionalVoteType?: AdditionalVoteType;
  nbPoints?: number;
}

export interface AddVoteResponse extends OperationResult {
  status: "success";
  nbVoteRemaining: number;
}

export interface CastVoteChoiceRequest {
  choiceUuid: string;
  nbVotes: number;
}

export interface CastVoteRequest {
  votes: CastVoteChoiceRequest[];
  sessionToken?: string;
  phoneFingerPrint?: string;
  ip?: string;
  userAgent?: string;
  uniqSubscriptionId?: string;
}

export interface CastVoteResponse extends OperationResult {
  status: "success";
  nbVoteRemaining: number;
}

export interface VoterBalance {
  standardPoint?: number;
  additionalPoint?: number;
  purchasedPoint?: number;
}

export interface GetVoterResponse {
  uniqRef: string;
  email?: string | null;
  phone?: string | null;
  remainingPoints: number;
  userFraudStatus: UserFraudStatus;
  balance: VoterBalance;
}
