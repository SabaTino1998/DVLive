#!/usr/bin/env bash
# Shared local smoke configuration. No eval, source of JSON, or export.
SMOKE_CONFIG_FILE="${SMOKE_CONFIG_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.json}"
command -v jq >/dev/null || { echo 'FAIL: jq required' >&2; exit 1; }
[[ -f "$SMOKE_CONFIG_FILE" ]] || { echo 'FAIL: create script/config.json from script/config.example.json' >&2; exit 1; }
jq -e 'type == "object" and all(.[]; type == "string")' "$SMOKE_CONFIG_FILE" >/dev/null 2>&1 || {
  echo 'FAIL: smoke config must be a JSON object with string values' >&2; exit 1;
}

smoke_load_config() {
  local key value
  # Only recognized names may become shell variables.
  for key in EXPO_PUBLIC_SMARTUSER_APP_ID EXPO_PUBLIC_SMARTUSER_SECRET EXPO_PUBLIC_SMARTUSER_ENV \
    SMART_USER_USERNAME SMART_USER_PASSWORD DVLIVE_BEARER_TOKEN SHOW_VOTE_UUID \
    SUPABASE_URL SUPABASE_ANON_KEY DVLIVE_ENV; do
    if jq -e --arg key "$key" 'has($key)' "$SMOKE_CONFIG_FILE" >/dev/null; then
      # Sentinel preserves any trailing newlines in a configured value.
      value="$(jq -j --arg key "$key" '.[$key]' "$SMOKE_CONFIG_FILE"; printf '.')"
      printf -v "$key" '%s' "${value%.}"
    fi
  done
}
smoke_load_config
