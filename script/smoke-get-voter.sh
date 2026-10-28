#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-00000000-0000-4000-8000-000000000001}"
USER_REF="${USER_REF:-dvlive-smoke}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" --arg user "$USER_REF" '{showVoteUuid:$show,userRef:$user}')
dvlive_request getVoter GET "$PARAMS"
dvlive_assert '(.uniqRef | type == "string") and (.remainingPoints | type == "number") and (.userFraudStatus | type == "string") and (.balance | type == "object")' 'expected GetVoterResponse'
dvlive_output getVoter
