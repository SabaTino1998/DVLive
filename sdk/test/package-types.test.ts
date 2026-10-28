// Resolve the built package's public declarations, without SDK source aliases.
import { ApiService, ApiMode, parseMode, type ApiEnvironment, type ApiResponse, type ShowVoteResponse } from "@digitalvirgo/dvlive-api";

function consumePackage(api: ApiService): Promise<ApiResponse<ShowVoteResponse>> {
  return api.getShowVote("show");
}
void consumePackage;

const environment: ApiEnvironment = "PROD";
new ApiService({ environment });
const parsed = parseMode("getShowVote");
const mode: ApiMode | null = parsed.mode;
void mode;
