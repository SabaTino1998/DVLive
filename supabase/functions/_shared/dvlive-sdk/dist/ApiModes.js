/** Supported operations. Values match the public mode query parameter. */
export var ApiModes;
(function (ApiModes) {
    ApiModes["GetShowVoteChoice"] = "getShowVoteChoice";
    ApiModes["GetShowVote"] = "getShowVote";
    ApiModes["CreateVoter"] = "createVoter";
    ApiModes["GetVoter"] = "getVoter";
    ApiModes["CastVote"] = "castVote";
})(ApiModes || (ApiModes = {}));
export const API_MODES = {
    [ApiModes.GetShowVoteChoice]: {
        method: "GET", params: ["uuid"], body: [],
        description: "Returns a participant: UUID, name, status, order, biography, images, and elimination/reintroduction rounds.",
        response: "ShowVoteChoice",
    },
    [ApiModes.GetShowVote]: {
        method: "GET", params: ["uuid"], body: [],
        description: "Returns the show name and dates, current round, and its participants.",
        response: "ShowVote",
    },
    [ApiModes.CreateVoter]: {
        method: "POST", params: ["showVoteUuid"], body: ["email", "phone", "uniqRef"],
        description: "Registers a voter and returns the operation result (status, code, message).",
        response: "CreateVoterResult",
    },
    [ApiModes.GetVoter]: {
        method: "GET", params: ["showVoteUuid", "userRef"], body: [],
        description: "Returns the voter reference and contact details, remaining points, fraud status, and balance breakdown.",
        response: "Voter",
    },
    [ApiModes.CastVote]: {
        method: "POST", params: ["showVoteUuid", "userRef"],
        body: ["votes", "sessionToken", "phoneFingerPrint", "ip", "userAgent", "uniqSubscriptionId"],
        requiredBody: ["votes"],
        description: "Casts votes for participants in the current round and returns the operation result, including nbVoteRemaining when provided by the API.",
        response: "CastVoteResult",
    },
};
export function getModeCatalog() {
    return {
        name: "DVLive",
        description: "Select a mode in the URL query. The params list contains required query parameters; body lists supported POST JSON fields and requiredBody lists mandatory body fields. Pass the DV Live token in the bearer-token header.",
        modes: API_MODES,
    };
}
/** Exact, case-sensitive parsing. Missing or unsupported modes return the catalog. */
export function parseMode(value) {
    const mode = Object.values(ApiModes).find((mode) => mode === value);
    return mode === undefined ? { mode: null, catalog: getModeCatalog() } : { mode, catalog: null };
}
//# sourceMappingURL=ApiModes.js.map