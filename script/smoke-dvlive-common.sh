#!/usr/bin/env bash
# Shared helpers for the DVLive smoke tests, following the Atom runner conventions.
set -euo pipefail

# Shared configuration is loaded from script/config.json. No export needed.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-config.sh"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
DVLIVE_BEARER_TOKEN="${DVLIVE_BEARER_TOKEN:-}"
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

resolve_anon_key() {
  if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
    printf '%s' "$SUPABASE_ANON_KEY"
    return
  fi
  if command -v supabase >/dev/null; then
    local key repo_root
    repo_root="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
    key=$(cd "$repo_root" && supabase status -o json 2>/dev/null | jq -r \
      '.ANON_KEY // .anon_key // .publishable_key // empty' || true)
    if [[ -n "$key" && "$key" != null ]]; then
      printf '%s' "$key"
      return
    fi
  fi
  printf '%s' 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
}

SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
FN="${SUPABASE_URL%/}/functions/v1/dvlive"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Hide SmartUser session tokens in console output; raw OUT_FILE stays opt-in.
dvlive_print_response() {
  if [[ "${USER_REF:-}" == N_* ]]; then
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
  local url=$FN key value
  local -a options=(--silent --show-error --connect-timeout 10 --max-time 60
    --request "$method" --output "$TMP" --write-out '%{http_code}'
    --header 'Accept: application/json'
    --header "Authorization: Bearer $SUPABASE_ANON_KEY"
    --header "apikey: $SUPABASE_ANON_KEY")
  if [[ -n "$mode" ]]; then
    if [[ "$require_token" == true ]]; then
      [[ -n "${DVLIVE_BEARER_TOKEN:-}" ]] || { echo 'FAIL: set DVLIVE_BEARER_TOKEN in script/config.json' >&2; exit 1; }
      options+=(--header "bearer-token: $DVLIVE_BEARER_TOKEN")
    fi
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
  if [[ "${USER_REF:-}" == N_* ]]; then
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
}

dvlive_assert() {
  if ! jq -e "$1" "$TMP" >/dev/null; then
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
