#!/usr/bin/env bash
# Source after smoke-config.sh. Credentials stay local to the smoke process.
AUTH_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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


sync_supabase_session() {
  [[ -z "${APP_JWT:-}" ]] || return 0
  local session
  session=$(printf '%s\0' "$EXPO_PUBLIC_SMARTUSER_APP_ID" "$EXPO_PUBLIC_SMARTUSER_SECRET" \
    "$EXPO_PUBLIC_SMARTUSER_ENV" "$SMART_USER_USERNAME" "$SMART_USER_PASSWORD" \
    "${SUPABASE_URL:-http://127.0.0.1:54321}" "$(resolve_anon_key)" "${EXPO_PUBLIC_SERVICE_SLUG:-dvlive}" \
    | node "$AUTH_SCRIPT_DIR/../test-support/smartuser.mjs" --stdin-fields --session) || return 1
  APP_JWT=$(jq -er '.access_token | select(type == "string" and length > 0)' <<<"$session") || return 1
  USER_REF=$(jq -er '.absolute_reference | select(type == "string" and length > 0)' <<<"$session") || return 1
}
