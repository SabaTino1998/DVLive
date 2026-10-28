#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-11111111-1111-4111-8111-111111111101}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

PARAMS=$(jq -n --arg uuid "$SHOW_VOTE_UUID" '{uuid:$uuid}')
dvlive_request getShowVote GET "$PARAMS"
dvlive_assert '(.name | type == "string") and (.startDate | type == "string") and (.endDate | type == "string") and (.round == null or (.round | type == "object"))' 'expected ShowVoteResponse'
dvlive_output getShowVote
