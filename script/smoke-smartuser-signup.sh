#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/smoke-config.sh"

command -v node >/dev/null || { echo 'FAIL: Node.js >=18 required' >&2; exit 1; }
for config_name in EXPO_PUBLIC_SMARTUSER_APP_ID EXPO_PUBLIC_SMARTUSER_SECRET EXPO_PUBLIC_SMARTUSER_ENV SMART_USER_USERNAME SMART_USER_PASSWORD; do
  [[ -n "${!config_name:-}" && "${!config_name:-}" != '<secret>' && "${!config_name:-}" != '<smartuser-secret>' && "${!config_name:-}" != '<test-user-email>' && "${!config_name:-}" != '<test-user-password>' ]] || { echo "FAIL: configure $config_name in script/config.json" >&2; exit 1; }
done

# Creates an EMAIL identity, then logs in and prints its N_ token.
# Use a new email: signup failure stops the test without falling back to login.
USER_TOKEN="$(printf '%s\0' \
  "$EXPO_PUBLIC_SMARTUSER_APP_ID" "$EXPO_PUBLIC_SMARTUSER_SECRET" "$EXPO_PUBLIC_SMARTUSER_ENV" \
  "$SMART_USER_USERNAME" "$SMART_USER_PASSWORD" \
  | node "$SCRIPT_DIR/../test-support/smartuser.mjs" --stdin-fields --debug --signup)"
[[ "$USER_TOKEN" == N_* ]] || { echo 'FAIL: expected SmartUser N_ token' >&2; exit 1; }
printf '%s\n' "$USER_TOKEN"
unset USER_TOKEN EXPO_PUBLIC_SMARTUSER_SECRET SMART_USER_PASSWORD
