#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Source local values without exporting credentials to child processes.
ENV_FILE="$SCRIPT_DIR/../.env"
[[ -f "$ENV_FILE" ]] || { echo 'FAIL: configure the repository .env (see .env.example)' >&2; exit 1; }
source "$ENV_FILE"

command -v node >/dev/null || { echo 'FAIL: Node.js >=18 required' >&2; exit 1; }
for config_name in EXPO_PUBLIC_SMARTUSER_APP_ID EXPO_PUBLIC_SMARTUSER_SECRET EXPO_PUBLIC_SMARTUSER_ENV SMART_USER_USERNAME SMART_USER_PASSWORD; do
  [[ -n "${!config_name:-}" && "${!config_name:-}" != '<secret>' ]] || { echo "FAIL: configure $config_name in the repository .env" >&2; exit 1; }
done

# SmartUser setup followed by email/password login; no voter requests.
USER_TOKEN="$(printf '%s\0' \
  "$EXPO_PUBLIC_SMARTUSER_APP_ID" "$EXPO_PUBLIC_SMARTUSER_SECRET" "$EXPO_PUBLIC_SMARTUSER_ENV" \
  "$SMART_USER_USERNAME" "$SMART_USER_PASSWORD" \
  | node "$SCRIPT_DIR/../test-support/smartuser.mjs" --stdin-fields --debug)"
[[ "$USER_TOKEN" == N_* ]] || { echo 'FAIL: expected SmartUser N_ token' >&2; exit 1; }
printf '%s\n' "$USER_TOKEN"
unset USER_TOKEN EXPO_PUBLIC_SMARTUSER_SECRET SMART_USER_PASSWORD
