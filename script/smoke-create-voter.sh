#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-11111111-1111-4111-8111-111111111101}"
USER_REF="${USER_REF:-N_69ab96c674a56fde37ee}" # Paste the N_ token returned by smoke-smartuser-token.sh.
EMAIL="${EMAIL:-dvlive@test.com}"
PHONE="${PHONE:-}"
EXPECTED_STATUS="${EXPECTED_STATUS:-201}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-dvlive-common.sh"
[[ "$USER_REF" == N_* ]] || {
  echo 'FAIL: paste the SmartUser N_ token into USER_REF in this smoke test.' >&2
  exit 1
}

# Creates a voter. Use a fresh USER_REF in a test show.
PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" '{showVoteUuid:$show}')
BODY=$(jq -n --arg user "$USER_REF" --arg email "${EMAIL}" --arg phone "${PHONE}" '
  {uniqRef:$user} + (if $email == "" then {} else {email:$email} end)
  + (if $phone == "" then {} else {phone:$phone} end)')
dvlive_request createVoter POST "$PARAMS" "$BODY" "${EXPECTED_STATUS}"
dvlive_assert '.status == "success" and (.code | type == "number") and (.message | type == "string")' 'expected successful OperationResult'
if [[ "$USER_REF" == N_* ]]; then echo 'USER_REF: [REDACTED]'; else echo "USER_REF: $USER_REF"; fi
dvlive_output createVoter
