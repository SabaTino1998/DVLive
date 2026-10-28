/** Supported operations. Values match the public mode query parameter. */
export enum ApiMode {
  GetShowVoteChoice = "getShowVoteChoice",
  GetShowVote = "getShowVote",
  CreateVoter = "createVoter",
  GetVoter = "getVoter",
  AddVote = "addVote",
  CastVote = "castVote",
}

export interface ApiModeDefinition {
  readonly method: "GET" | "POST";
  /** Required URL query parameters, excluding mode itself. */
  readonly params: readonly string[];
  /** Supported JSON body fields. */
  readonly body: readonly string[];
  readonly requiredBody?: readonly string[];
  readonly description: string;
  readonly response: string;
}

export const API_MODES: Readonly<Record<ApiMode, ApiModeDefinition>> = {
  [ApiMode.GetShowVoteChoice]: {
    method: "GET", params: ["uuid"], body: [],
    description: "Returns a participant: UUID, name, status, order, biography, images, and elimination/reintroduction rounds.",
    response: "ShowVoteChoiceResponse",
  },
  [ApiMode.GetShowVote]: {
    method: "GET", params: ["uuid"], body: [],
    description: "Returns the show name and dates, current round, and its participants.",
    response: "ShowVoteResponse",
  },
  [ApiMode.CreateVoter]: {
    method: "POST", params: ["showVoteUuid"], body: ["email", "phone", "uniqRef"],
    description: "Registers a voter and returns the operation result (status, code, message).",
    response: "CreateVoterResponse",
  },
  [ApiMode.GetVoter]: {
    method: "GET", params: ["showVoteUuid", "userRef"], body: [],
    description: "Returns the voter reference and contact details, remaining points, fraud status, and balance breakdown.",
    response: "GetVoterResponse",
  },
  [ApiMode.AddVote]: {
    method: "POST", params: ["showVoteUuid", "userRef"], body: ["additionalVoteType", "nbPoints"],
    description: "Credits additional votes and returns the operation result, including nbVoteRemaining when provided by the API.",
    response: "AddVoteResponse",
  },
  [ApiMode.CastVote]: {
    method: "POST", params: ["showVoteUuid", "userRef"],
    body: ["votes", "sessionToken", "phoneFingerPrint", "ip", "userAgent", "uniqSubscriptionId"],
    requiredBody: ["votes"],
    description: "Casts votes for participants in the current round and returns the operation result, including nbVoteRemaining when provided by the API.",
    response: "CastVoteResponse",
  },
};


export interface ModeCatalog {
  name: "DVLive";
  description: string;
  modes: Readonly<Record<ApiMode, ApiModeDefinition>>;
}

export type ModeParseResult =
  | { mode: ApiMode; catalog: null }
  | { mode: null; catalog: ModeCatalog };

export function getModeCatalog(): ModeCatalog {
  return {
    name: "DVLive",
    description: "Select a mode in the URL query. The params list contains required query parameters; body lists supported POST JSON fields and requiredBody lists mandatory body fields. Pass the DV Live token in the bearer-token header.",
    modes: API_MODES,
  };
}

/** Exact, case-sensitive parsing. Missing or unsupported modes return the catalog. */
export function parseMode(value: string | null | undefined): ModeParseResult {
  const mode = Object.values(ApiMode).find((mode) => mode === value);
  return mode === undefined ? { mode: null, catalog: getModeCatalog() } : { mode, catalog: null };
}
