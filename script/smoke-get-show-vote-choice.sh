#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
CHOICE_UUID="${CHOICE_UUID:-22222222-2222-4222-8222-222222222201}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

PARAMS=$(jq -n --arg uuid "$CHOICE_UUID" '{uuid:$uuid}')
dvlive_request getShowVoteChoice GET "$PARAMS"
dvlive_assert 'has("uuid") and has("showVoteUuid") and (.firstname | type == "string") and (.lastname | type == "string") and (.status | type == "string") and (.order | type == "number")' 'expected ShowVoteChoiceResponse'
dvlive_output getShowVoteChoice
