// Resolve the built package's public declarations, without SDK source aliases.
import { ApiService, ApiModes, parseMode, type ApiResult, ApiResponse, ShowVote, GetShowVoteRequest, CastVoteBody, CastVoteRequest } from "@digitalvirgo/dvlive-api";

function consumePackage(api: ApiService): Promise<ApiResponse<ShowVote>> {
  const request: GetShowVoteRequest = new GetShowVoteRequest("show");
  return api.getShowVote(request);
}
void consumePackage;

const environment: string | undefined = "PROD";
new ApiService({ environment });
const parsed = parseMode("getShowVote");
const mode: ApiModes | null = parsed.mode;
void mode;

// Wire responses and old public response aliases are not part of the package API.
// @ts-expect-error Consumers receive ShowVote DTOs, not service response models.
import type { ShowVoteResponse } from "@digitalvirgo/dvlive-api";
// @ts-expect-error The old GetVoterResponse alias has been replaced by Voter.
import type { GetVoterResponse } from "@digitalvirgo/dvlive-api";

const model: ShowVote = new ShowVote("Show", "2026-01-01", "2026-12-31");
const mapped: ShowVote = ShowVote.fromResponse({ name: "Show", startDate: "2026-01-01", endDate: "2026-12-31" });
const wrapped: ApiResponse<ShowVote> = new ApiResponse(mapped, 200, new Headers());
void model;
void wrapped;
// @ts-expect-error Constructor fields retain their declared types.
new ShowVote(123, "start", "end");
// @ts-expect-error Factory input requires the original response fields.
ShowVote.fromResponse({ title: "Show" });

const operationResult: ApiResult = model;
const operationResponse: ApiResponse<ApiResult> = wrapped;
void operationResult;
void operationResponse;
// @ts-expect-error Arbitrary values are not SDK operation results.
const invalidOperationResult: ApiResult = "invalid";
void invalidOperationResult;

// @ts-expect-error Environment values are internal to the SDK, not a public enum or union.
import type { ApiEnvironment } from "@digitalvirgo/dvlive-api";

const voteBody = CastVoteBody.decode({ votes: [{ choiceUuid: "choice", nbVotes: 1 }] });
const voteRequest = new CastVoteRequest("show", "voter", voteBody);
void voteRequest;
import { CastVoteChoiceRequest } from "@digitalvirgo/dvlive-api";

const typedVoteBody = new CastVoteBody({ votes: [new CastVoteChoiceRequest("choice", 1)] });
void typedVoteBody;
