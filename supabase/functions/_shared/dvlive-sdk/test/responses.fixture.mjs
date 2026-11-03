import { GetShowVoteRequest } from "../dist/requests/show-vote.js";
import { GetShowVoteChoiceRequest } from "../dist/requests/show-vote-choice.js";
import {
  GetVoterRequest, CreateVoterRequest, CastVoteRequest,
  CreateVoterBody, CastVoteBody,
} from "../dist/requests/voter.js";

export function makeRequest(method, fields) {
  switch (method) {
    case "getShowVote": return new GetShowVoteRequest(fields.uuid);
    case "getShowVoteChoice": return new GetShowVoteChoiceRequest(fields.uuid);
    case "getVoter": return new GetVoterRequest(fields.showVoteUuid, fields.userRef);
    case "createVoter": return new CreateVoterRequest(fields.showVoteUuid, CreateVoterBody.decode(fields.body));
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
  ["castVote", [{ showVoteUuid: "show", userRef: "a/b", body: { votes: [{ choiceUuid: "choice", nbVotes: 1 }], sessionToken: "session" } }], "/show-vote/show/voter/a%2Fb/vote", { ...operation, nbVoteRemaining: 2 }],
];


export const requestCases = rawCases;
export const requestBodies = Object.fromEntries(rawCases.map(([method, [input]]) => [method, input.body]));
export const cases = rawCases.map(([method, [input], path, payload]) => {
  const args = method === "getShowVote" || method === "getShowVoteChoice" ? [input.uuid]
    : method === "getVoter" ? [{ showVoteUuid: input.showVoteUuid, userRef: input.userRef }]
    : [{ ...input.body, showVoteUuid: input.showVoteUuid, ...(method === "createVoter" ? {} : { userRef: input.userRef }) }];
  return [method, args, path, payload];
});
