#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-00000000-0000-4000-8000-000000000001}"
USER_REF="${USER_REF:-dvlive-smoke}"
NB_POINTS="${NB_POINTS:-1}"
ADDITIONAL_VOTE_TYPE="${ADDITIONAL_VOTE_TYPE:-VIDEO}"
EXPECTED_STATUS="${EXPECTED_STATUS:-201}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

# Credits points to the configured test voter.
PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" --arg user "$USER_REF" '{showVoteUuid:$show,userRef:$user}')
POINTS=$(jq -en --arg value "${NB_POINTS}" '$value | tonumber | select(isfinite and . > 0 and floor == .)') || {
  echo 'FAIL: NB_POINTS must be a positive integer' >&2; exit 1;
}
BODY=$(jq -n --arg kind "${ADDITIONAL_VOTE_TYPE}" --argjson points "$POINTS" '{additionalVoteType:$kind,nbPoints:$points}')
dvlive_request addVote POST "$PARAMS" "$BODY" "${EXPECTED_STATUS}"
dvlive_assert '.status == "success" and (.code | type == "number") and (.message | type == "string")' 'expected successful OperationResult'
dvlive_output addVote
