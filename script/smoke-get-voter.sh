#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-11111111-1111-4111-8111-111111111101}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-dvlive-common.sh"


PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" '{showVoteUuid:$show}')
dvlive_request getVoter GET "$PARAMS"
dvlive_assert '(.uniqRef | type == "string") and (.remainingPoints | type == "number") and (.userFraudStatus | type == "string") and (.balance | type == "object")' 'expected GetVoterResponse'
dvlive_output getVoter
