#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-config.sh"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/smoke-auth-common.sh"
sync_supabase_session
echo 'PASS: SmartUser login and bolt-auth-proxy syncUser session'
