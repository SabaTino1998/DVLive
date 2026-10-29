#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-11111111-1111-4111-8111-111111111101}"
USER_REF="${USER_REF:-N_35c4251d9ca734b136a4}" # Paste the N_ token returned by smoke-smartuser-token.sh.
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-dvlive-common.sh"
[[ "$USER_REF" == N_* ]] || {
  echo 'FAIL: paste the SmartUser N_ token into USER_REF in this smoke test.' >&2
  exit 1
}

PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" --arg user "$USER_REF" '{showVoteUuid:$show,userRef:$user}')
dvlive_request getVoter GET "$PARAMS"
dvlive_assert '(.uniqRef | type == "string") and (.remainingPoints | type == "number") and (.userFraudStatus | type == "string") and (.balance | type == "object")' 'expected GetVoterResponse'
dvlive_output getVoter
