import { ApiResponse } from "./models/api-response.ts";
import { ShowVote } from "./models/show-vote.ts";
import { ShowVoteChoice } from "./models/show-vote-choice.ts";
import { CastVoteResult, CreateVoterResult, Voter } from "./models/voter.ts";
import type { GetVoterInput, CreateVoterInput, CastVoteInput } from "./requests/voter.ts";
export interface ApiServiceConfig {
    environment: string | undefined;
    /** LOCAL uses internal hosts; PROD (default) uses external hosts. */
    mode?: string;
    headers?: Record<string, string> | (() => Record<string, string>);
    timeoutMs?: number;
    /** Accepts TRUE/FALSE environment strings or booleans. Defaults to false. */
    logEnable?: boolean | string;
    /** WARNING (default), INFO or DEBUG. Applied only when logging is enabled. */
    logLevel?: string;
}
export declare class ApiService {
    private readonly url;
    private readonly extraHeaders;
    private readonly timeoutMs;
    private readonly logger;
    constructor(config: ApiServiceConfig);
    getShowVote(uuid: string): Promise<ApiResponse<ShowVote>>;
    getShowVoteChoice(uuid: string): Promise<ApiResponse<ShowVoteChoice>>;
    createVoter(...args: [input: CreateVoterInput] | [input: Pick<CreateVoterInput, "showVoteUuid">, body: unknown]): Promise<ApiResponse<CreateVoterResult>>;
    getVoter(input: GetVoterInput): Promise<ApiResponse<Voter>>;
    castVote(...args: [input: CastVoteInput] | [input: Pick<CastVoteInput, "showVoteUuid" | "userRef">, body: unknown]): Promise<ApiResponse<CastVoteResult>>;
    private voterPath;
    private request;
}
//# sourceMappingURL=ApiService.d.ts.map