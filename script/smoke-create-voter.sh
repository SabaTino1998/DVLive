#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-00000000-0000-4000-8000-000000000001}"
USER_REF="${USER_REF:-dvlive-smoke}"
EMAIL="${EMAIL:-}"
PHONE="${PHONE:-}"
EXPECTED_STATUS="${EXPECTED_STATUS:-201}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

# Creates a voter. Use a fresh USER_REF in a test show.
PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" '{showVoteUuid:$show}')
BODY=$(jq -n --arg user "$USER_REF" --arg email "${EMAIL}" --arg phone "${PHONE}" '
  {uniqRef:$user} + (if $email == "" then {} else {email:$email} end)
  + (if $phone == "" then {} else {phone:$phone} end)')
dvlive_request createVoter POST "$PARAMS" "$BODY" "${EXPECTED_STATUS}"
dvlive_assert '.status == "success" and (.code | type == "number") and (.message | type == "string")' 'expected successful OperationResult'
echo "USER_REF: $USER_REF"
dvlive_output createVoter
