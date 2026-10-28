import {
  GetShowVoteRequest, GetShowVoteChoiceRequest, GetVoterRequest,
  CreateVoterRequest, AddVoteRequest, CastVoteRequest, CreateVoterBody, AddVoteBody, CastVoteBody,
} from "@digitalvirgo/dvlive-api";

export function makeRequest(method, fields) {
  switch (method) {
    case "getShowVote": return new GetShowVoteRequest(fields.uuid);
    case "getShowVoteChoice": return new GetShowVoteChoiceRequest(fields.uuid);
    case "getVoter": return new GetVoterRequest(fields.showVoteUuid, fields.userRef);
    case "createVoter": return new CreateVoterRequest(fields.showVoteUuid, CreateVoterBody.decode(fields.body));
    case "addVote": return new AddVoteRequest(fields.showVoteUuid, fields.userRef, AddVoteBody.decode(fields.body));
    case "castVote": return new CastVoteRequest(fields.showVoteUuid, fields.userRef, CastVoteBody.decode(fields.body));
    default: throw new Error("Unknown method");
  }
}

export const show = { name: "Show", startDate: "2026-01-01", endDate: "2026-12-31", round: null };
export const choice = { uuid: "choice", showVoteUuid: "show", firstname: "First", lastname: "Last", status: "ACTIVE", order: 1, bio: null };
export const voter = { uniqRef: "a/b", remainingPoints: 3, userFraudStatus: "CLEAN", balance: { standardPoint: 3 } };
export const operation = { status: "success", code: 201, message: "Recorded" };
const rawCases = [
  ["getShowVote", [{ uuid: "a/b" }], "/show-vote/a%2Fb", show],
  ["getShowVoteChoice", [{ uuid: "choice" }], "/show-vote-choice/choice", choice],
  ["getVoter", [{ showVoteUuid: "show", userRef: "a/b ?#" }], "/show-vote/show/voter/a%2Fb%20%3F%23", voter],
  ["createVoter", [{ showVoteUuid: "show", body: { uniqRef: "a/b", phone: null } }], "/show-vote/show/voter", operation],
  ["addVote", [{ showVoteUuid: "show", userRef: "a/b", body: { nbPoints: 3, additionalVoteType: "VIDEO" } }], "/show-vote/show/voter/a%2Fb/add-vote", { ...operation, nbVoteRemaining: 3 }],
  ["castVote", [{ showVoteUuid: "show", userRef: "a/b", body: { votes: [{ choiceUuid: "choice", nbVotes: 1 }], sessionToken: "session" } }], "/show-vote/show/voter/a%2Fb/vote", { ...operation, nbVoteRemaining: 2 }],
];


export const cases = rawCases.map(([method, [request], path, payload]) => [method, [makeRequest(method, request)], path, payload]);
