import {
  ApiService, type ApiResponse, type ShowVote, type ShowVoteChoice,
  ApiModes, parseMode, API_MODES, type ModeCatalog,
  type Voter, type CreateVoterResult, type AddVoteResult, type CastVoteResult,
  GetShowVoteRequest, GetShowVoteChoiceRequest, GetVoterRequest,
  CreateVoterRequest, AddVoteRequest, CastVoteRequest,
  CreateVoterBody, AddVoteBody, CastVoteBody,
} from "../src/index.ts";

// Compile-time contract checks. This function is never invoked against a real API.
async function publicContract(api: ApiService) {
  const showRequest: GetShowVoteRequest = new GetShowVoteRequest("show");
  const choiceRequest: GetShowVoteChoiceRequest = new GetShowVoteChoiceRequest("choice");
  const voterRequest: GetVoterRequest = new GetVoterRequest("show", "voter");
  const createBody: CreateVoterBody = new CreateVoterBody({ phone: null });
  const addBody: AddVoteBody = new AddVoteBody({ additionalVoteType: "REFERAL", nbPoints: 1 });
  const castBody: CastVoteBody = CastVoteBody.decode({ votes: [{ choiceUuid: "choice", nbVotes: 1 }] });
  const createRequest: CreateVoterRequest = new CreateVoterRequest("show", createBody);
  const addRequest: AddVoteRequest = new AddVoteRequest("show", "voter", addBody);
  const castRequest: CastVoteRequest = new CastVoteRequest("show", "voter", castBody);
  const show: ApiResponse<ShowVote> = await api.getShowVote(showRequest);
  const choice: ApiResponse<ShowVoteChoice> = await api.getShowVoteChoice(choiceRequest);
  const voter: ApiResponse<Voter> = await api.getVoter(voterRequest);
  const created: ApiResponse<CreateVoterResult> = await api.createVoter(createRequest);
  const credited: ApiResponse<AddVoteResult> = await api.addVote(addRequest);
  const voted: ApiResponse<CastVoteResult> = await api.castVote(castRequest);
  const remaining: number = voted.data.nbVoteRemaining;
  const headers: Headers = show.headers;
  const status: number = show.status;
  // @ts-expect-error The response model does not contain this field.
  show.data.nbVoteRemaining;
  // @ts-expect-error Additional vote types follow the upstream enum.
  new AddVoteBody({ additionalVoteType: "INVALID" });
  // @ts-expect-error Casting a vote requires typed vote instances.
  new CastVoteBody({ votes: [{ choiceUuid: "choice", nbVotes: 1 }] });
  // @ts-expect-error GET methods require a request object, not positional values.
  api.getShowVote("show");
  // @ts-expect-error Voter requests require both path parameters.
  api.getVoter({ showVoteUuid: "show" });
  // @ts-expect-error POST requests require an explicit body property.
  api.createVoter({ showVoteUuid: "show" });
  // @ts-expect-error Body fields belong inside body, not at the request root.
  api.addVote({ showVoteUuid: "show", userRef: "voter", nbPoints: 1 });
  // @ts-expect-error Plain objects must be constructed into validated request classes.
  api.getShowVote({ uuid: "show" });
  return { show, choice, voter, created, credited, voted, remaining, headers, status };
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
