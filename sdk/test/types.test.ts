import {
  ApiService, type ApiEnvironment, type ApiResponse, type ShowVoteResponse, type ShowVoteChoiceResponse,
  ApiMode, parseMode, API_MODES, type ModeCatalog,
  type GetVoterResponse, type CreateVoterResponse, type AddVoteResponse, type CastVoteResponse,
} from "../src/index.ts";

// Compile-time contract checks. This function is never invoked against a real API.
async function publicContract(api: ApiService) {
  const show: ApiResponse<ShowVoteResponse> = await api.getShowVote("show");
  const choice: ApiResponse<ShowVoteChoiceResponse> = await api.getShowVoteChoice("choice");
  const voter: ApiResponse<GetVoterResponse> = await api.getVoter("show", "voter");
  const created: ApiResponse<CreateVoterResponse> = await api.createVoter("show", { phone: null });
  const credited: ApiResponse<AddVoteResponse> = await api.addVote("show", "voter", { additionalVoteType: "REFERAL", nbPoints: 1 });
  const voted: ApiResponse<CastVoteResponse> = await api.castVote("show", "voter", { votes: [{ choiceUuid: "choice", nbVotes: 1 }] });
  const remaining: number = voted.data.nbVoteRemaining;
  const headers: Headers = show.headers;
  const status: number = show.status;
  // @ts-expect-error The response model does not contain this field.
  show.data.nbVoteRemaining;
  // @ts-expect-error Additional vote types follow the upstream enum.
  api.addVote("show", "voter", { additionalVoteType: "INVALID" });
  // @ts-expect-error Casting a vote requires a votes array.
  api.castVote("show", "voter", {});
  return { show, choice, voter, created, credited, voted, remaining, headers, status };
}
void publicContract;

const environment: ApiEnvironment = "STAG";
new ApiService({ environment });
new ApiService({ environment: "PROD" });
// @ts-expect-error Only STAG and PROD are supported environments.
new ApiService({ environment: "DEV" });
// @ts-expect-error The environment is required; callers do not provide a base URL.
new ApiService({ url: "https://upstream.test" });

function enumContract(query: string | null) {
  const parsed = parseMode(query);
  if (parsed.mode === null) {
    const catalog: ModeCatalog = parsed.catalog;
    return catalog;
  }
  const mode: ApiMode = parsed.mode;
  const params: readonly string[] = API_MODES[mode].params;
  return params;
}
// @ts-expect-error Query strings must be parsed before they can be used as ApiMode.
const unparsed: ApiMode = "getShowVote";
void enumContract;
void unparsed;
