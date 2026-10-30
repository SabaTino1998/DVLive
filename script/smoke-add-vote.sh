#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-config.sh"

# Local configuration: edit the defaults after :- below; no export is needed.
SHOW_VOTE_UUID="${SHOW_VOTE_UUID:-11111111-1111-4111-8111-111111111101}"
USER_REF="${USER_REF:-N_35c4251d9ca734b136a4}" # Paste the N_ token returned by smoke-smartuser-token.sh.
NB_POINTS="${NB_POINTS:-100}"
ADDITIONAL_VOTE_TYPE="${ADDITIONAL_VOTE_TYPE:-VIDEO}"
EXPECTED_STATUS="${EXPECTED_STATUS:-201}"
OUT_FILE="${OUT_FILE:-}"

# Direct DV Live configuration: no Supabase gateway or SDK.
DVLIVE_ENV="${DVLIVE_ENV:-STAG}"
DVLIVE_BEARER_TOKEN="${DVLIVE_BEARER_TOKEN:-}"

command -v curl >/dev/null || { echo 'FAIL: curl required' >&2; exit 1; }
command -v jq >/dev/null || { echo 'FAIL: jq required' >&2; exit 1; }
case "$DVLIVE_ENV" in
  STAG) DVLIVE_BASE_URL='https://dev-webshow-engine.dv-live.com' ;;
  PROD) DVLIVE_BASE_URL='https://webshow-engine.dv-live.com' ;;
  *) echo 'FAIL: DVLIVE_ENV must be STAG or PROD' >&2; exit 1 ;;
esac
[[ -n "$DVLIVE_BEARER_TOKEN" ]] || { echo 'FAIL: configure DVLIVE_BEARER_TOKEN in script/config.json' >&2; exit 1; }
[[ -n "$SHOW_VOTE_UUID" ]] || { echo 'FAIL: SHOW_VOTE_UUID required' >&2; exit 1; }
[[ "$USER_REF" == N_* ]] || { echo 'FAIL: paste the SmartUser N_ token into USER_REF in this smoke test.' >&2; exit 1; }
case "$ADDITIONAL_VOTE_TYPE" in
  PURCHASE|SPONSOR|VIDEO|GAME|REFERAL|PROMO) ;;
  *) echo 'FAIL: invalid ADDITIONAL_VOTE_TYPE' >&2; exit 1 ;;
esac
POINTS=$(jq -en --arg value "$NB_POINTS" '$value | tonumber | select(isfinite and . > 0 and floor == .)') || {
  echo 'FAIL: NB_POINTS must be a positive integer' >&2; exit 1;
}
BODY=$(jq -n --arg kind "$ADDITIONAL_VOTE_TYPE" --argjson points "$POINTS" '{additionalVoteType:$kind,nbPoints:$points}')
SHOW_PATH=$(jq -rn --arg value "$SHOW_VOTE_UUID" '$value | @uri')
USER_PATH=$(jq -rn --arg value "$USER_REF" '$value | @uri')
URL="$DVLIVE_BASE_URL/show-vote/$SHOW_PATH/voter/$USER_PATH/add-vote"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
HTTP=$(curl --silent --show-error --connect-timeout 10 --max-time 60 \
  --request POST --output "$TMP" --write-out '%{http_code}' \
  --header 'Accept: application/json' \
  --header "Authorization: Bearer $DVLIVE_BEARER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-raw "$BODY" "$URL") || { echo 'FAIL: request failed' >&2; exit 1; }
echo "URL: $DVLIVE_BASE_URL/show-vote/$SHOW_PATH/voter/[REDACTED]/add-vote"
echo "HTTP: $HTTP"
if [[ "$HTTP" != "$EXPECTED_STATUS" ]]; then
  cat "$TMP" >&2
  echo "FAIL: expected HTTP $EXPECTED_STATUS" >&2
  exit 1
fi
jq -e '.status == "success" and (.code | type == "number") and (.message | type == "string")' "$TMP" >/dev/null || {
  cat "$TMP" >&2
  echo 'FAIL: expected successful OperationResult' >&2
  exit 1
}
if [[ -n "$OUT_FILE" ]]; then
  jq . "$TMP" > "$OUT_FILE"
  echo "Wrote: $OUT_FILE"
else
  jq . "$TMP"
fi
echo 'PASS: addVote response is valid (direct DV Live request)'
