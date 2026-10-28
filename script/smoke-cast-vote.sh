#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-00000000-0000-4000-8000-000000000001}"
USER_REF="${USER_REF:-dvlive-smoke}"
CHOICE_UUID="${CHOICE_UUID:-22222222-2222-4222-8222-222222222201}"
VOTES="${VOTES:-}"
SESSION_TOKEN="${SESSION_TOKEN:-}"
PHONE_FINGER_PRINT="${PHONE_FINGER_PRINT:-}"
IP="${IP:-}"
USER_AGENT="${USER_AGENT:-}"
UNIQ_SUBSCRIPTION_ID="${UNIQ_SUBSCRIPTION_ID:-}"
EXPECTED_STATUS="${EXPECTED_STATUS:-200}"
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

# Casts votes for the configured voter; VOTES can override the default single vote.
PARAMS=$(jq -n --arg show "$SHOW_VOTE_UUID" --arg user "$USER_REF" '{showVoteUuid:$show,userRef:$user}')
DEFAULT_VOTES=$(jq -n --arg choice "$CHOICE_UUID" '[{choiceUuid:$choice,nbVotes:1}]')
VOTE_LIST=${VOTES:-$DEFAULT_VOTES}
jq -e 'type == "array" and length > 0 and all(.[]; (.choiceUuid | type == "string" and length > 0) and (.nbVotes | type == "number" and . > 0 and floor == .))' <<<"$VOTE_LIST" >/dev/null || {
  echo 'FAIL: VOTES must contain choiceUuid and positive integer nbVotes' >&2; exit 1;
}
BODY=$(jq -n --argjson votes "$VOTE_LIST" --arg session "${SESSION_TOKEN}" --arg fingerprint "${PHONE_FINGER_PRINT}" \
  --arg ip "${IP}" --arg agent "${USER_AGENT}" --arg subscription "${UNIQ_SUBSCRIPTION_ID}" '
  {votes:$votes} + ({sessionToken:$session,phoneFingerPrint:$fingerprint,ip:$ip,userAgent:$agent,uniqSubscriptionId:$subscription} | with_entries(select(.value != "")))')
dvlive_request castVote POST "$PARAMS" "$BODY" "${EXPECTED_STATUS}"
dvlive_assert '.status == "success" and (.code | type == "number") and (.message | type == "string")' 'expected successful OperationResult'
dvlive_output castVote
