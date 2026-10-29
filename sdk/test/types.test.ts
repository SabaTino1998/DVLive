import {
  ApiService, type ApiResponse, type ShowVote, type ShowVoteChoice,
  ApiModes, parseMode, API_MODES, type ModeCatalog,
  type Voter, type CreateVoterResult, type CastVoteResult,
  type GetVoterInput, type CreateVoterInput, type CastVoteInput,
} from "../src/index.ts";

// Compile-time contract checks. This function is never invoked against a real API.
async function publicContract(api: ApiService) {
  const voterInput: GetVoterInput = { showVoteUuid: "show", userRef: "voter" };
  const createInput: CreateVoterInput = { showVoteUuid: "show", phone: null };
  const castInput: CastVoteInput = { ...voterInput, votes: [{ choiceUuid: "choice", nbVotes: 1 }] };
  const show: ApiResponse<ShowVote> = await api.getShowVote("show");
  const choice: ApiResponse<ShowVoteChoice> = await api.getShowVoteChoice("choice");
  const voter: ApiResponse<Voter> = await api.getVoter(voterInput);
  const created: ApiResponse<CreateVoterResult> = await api.createVoter(createInput);
  const voted: ApiResponse<CastVoteResult> = await api.castVote(castInput);
  const json: unknown = { votes: [{ choiceUuid: "choice", nbVotes: 1 }] };
  await api.castVote(voterInput, json);
  await api.createVoter({ showVoteUuid: "show" }, json);
  const remaining: number = voted.data.nbVoteRemaining;
  const headers: Headers = show.headers;
  const status: number = show.status;
  // @ts-expect-error The response model does not contain this field.
  show.data.nbVoteRemaining;
  // @ts-expect-error Vote credits are not exposed by the SDK.
  api.addVote(voterInput);
  // @ts-expect-error Casting a vote requires votes in the typed input.
  api.castVote(voterInput);
  // @ts-expect-error Vote counts must be numbers.
  api.castVote({ ...voterInput, votes: [{ choiceUuid: "choice", nbVotes: "1" }] });
  // @ts-expect-error Show queries take the original UUID string.
  api.getShowVote({ uuid: "show" });
  // @ts-expect-error Voter inputs require both path parameters.
  api.getVoter({ showVoteUuid: "show" });
  return { show, choice, voter, created, voted, remaining, headers, status };
}
void publicContract;

const environment: string | undefined = "STAG";
new ApiService({ environment });
new ApiService({ environment: "PROD" });
// Environment values from configuration are validated by the SDK at runtime.
function fromEnvironment(environment: string | undefined): ApiService {
  return new ApiService({ environment });
}
void fromEnvironment;
// @ts-expect-error The environment is required; callers do not provide a base URL.
new ApiService({ url: "https://upstream.test" });

function enumContract(query: string | null) {
  const parsed = parseMode(query);
  if (parsed.mode === null) {
    const catalog: ModeCatalog = parsed.catalog;
    return catalog;
  }
  const mode: ApiModes = parsed.mode;
  const params: readonly string[] = API_MODES[mode].params;
  return params;
}
// @ts-expect-error Query strings must be parsed before they can be used as ApiModes.
const unparsed: ApiModes = "getShowVote";
void enumContract;
void unparsed;
