#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

for mode in '' unknown __proto__; do
  dvlive_request "$mode" GET '{}' '' 200 false
  dvlive_assert '.name == "DVLive" and (.modes | keys == (["getShowVoteChoice","getShowVote","getVoter","createVoter","castVote"] | sort)) and (.modes | all((.description | type == "string" and length > 0) and (.params | type == "array" and length > 0) and (.response | type == "string")))' 'expected complete mode catalog with descriptions and required parameters'
done
dvlive_output catalog
