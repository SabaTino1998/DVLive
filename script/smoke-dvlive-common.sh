#!/usr/bin/env bash
# Shared helpers for the DVLive smoke tests, following the Atom runner conventions.
set -euo pipefail

# Shared configuration is loaded from script/config.json. No export needed.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-config.sh"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
# Leave SUPABASE_ANON_KEY empty for local auto-detection.

case "${1:-}" in
  --help|-h)
    echo "Usage: $0"
    echo 'Set URL and credentials in script/config.json; no export is needed.'
    echo 'Set mode parameters in the local configuration block of each test; see script/README.md.'
    exit 0 ;;
  '') ;;
  *) echo "FAIL: unknown argument: $1" >&2; exit 1 ;;
esac

command -v curl >/dev/null || { echo 'FAIL: curl required' >&2; exit 1; }
command -v jq >/dev/null || { echo 'FAIL: jq required' >&2; exit 1; }

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-auth-common.sh"

SUPABASE_ANON_KEY="$(resolve_anon_key)"
FN="${SUPABASE_URL%/}/functions/v1/dvlive"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Hide SmartUser session tokens in console output; raw OUT_FILE stays opt-in.
dvlive_print_response() {
  if [[ -n "${USER_REF:-}" ]]; then
    local response
    response=$(cat "$TMP")
    printf '%s\n' "${response//"$USER_REF"/[REDACTED]}"
  else
    cat "$TMP"
  fi
}

# dvlive_request MODE METHOD QUERY_JSON [BODY_JSON] [EXPECTED_STATUS] [REQUIRE_TOKEN]
dvlive_request() {
  local mode=$1 method=$2 params=$3 body=${4-} expected=${5:-200} require_token=${6:-true}
  DVLIVE_ENVELOPED=false
  local authorization=$SUPABASE_ANON_KEY
  case "$mode" in
    getShowVote|getShowVoteChoice|getVoter|createVoter|castVote) sync_supabase_session; authorization=$APP_JWT ;;
  esac
  local url=$FN key value
  local -a options=(--silent --show-error --connect-timeout 10 --max-time 60
    --request "$method" --output "$TMP" --write-out '%{http_code}'
    --header 'Accept: application/json'
    --header "Authorization: Bearer $authorization"
    --header "apikey: $SUPABASE_ANON_KEY")
  if [[ -n "$mode" ]]; then
    url+="?mode=$(jq -rn --arg value "$mode" '$value | @uri')"
  fi
  while IFS= read -r key; do
    value=$(jq -r --arg key "$key" '.[$key] | tostring | @uri' <<<"$params")
    if [[ "$url" == *\?* ]]; then url+='&'; else url+='?'; fi
    url+="$(jq -rn --arg value "$key" '$value | @uri')=$value"
  done < <(jq -r 'keys[]' <<<"$params")
  [[ -z "$body" ]] || options+=(--header 'Content-Type: application/json' --data-raw "$body")
  HTTP=$(curl "${options[@]}" "$url") || { echo 'FAIL: request failed' >&2; exit 1; }
  local display_url=$url
  if [[ -n "${USER_REF:-}" ]]; then
    local encoded_ref
    encoded_ref=$(jq -rn --arg value "$USER_REF" '$value | @uri')
    display_url=${display_url//"$encoded_ref"/[REDACTED]}
  fi
  echo "URL: $display_url"
  echo "HTTP: $HTTP"
  if [[ "$HTTP" != "$expected" ]]; then
    dvlive_print_response >&2
    echo "FAIL: expected HTTP $expected" >&2
    exit 1
  fi
  dvlive_assert 'type == "object"' 'expected JSON object'
  if [[ "$require_token" == true ]]; then
    dvlive_assert '.ok == true and has("data")' 'expected BBM success envelope'
    DVLIVE_ENVELOPED=true
  fi
}

dvlive_assert() {
  local expression=$1
  if [[ "${DVLIVE_ENVELOPED:-false}" == true ]]; then expression=".data | ($expression)"; fi
  if ! jq -e "$expression" "$TMP" >/dev/null; then
    dvlive_print_response >&2
    echo "FAIL: $2" >&2
    exit 1
  fi
}

dvlive_output() {
  if [[ -n "${OUT_FILE:-}" ]]; then
    jq . "$TMP" > "$OUT_FILE"
    echo "Wrote: $OUT_FILE"
  else
    dvlive_print_response | jq .
  fi
  echo "PASS: $1 response is valid"
}
