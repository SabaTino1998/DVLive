#!/usr/bin/env bash
set -euo pipefail

# Local configuration: edit the defaults after :- below; no export is needed.
OUT_FILE="${OUT_FILE:-}"

source "$(cd "$(dirname "$0")" && pwd)/smoke-dvlive-common.sh"

dvlive_request '' GET '{}'
dvlive_assert '.name == "DVLive" and (.modes | keys == (["getShowVoteChoice","getShowVote","getVoter","createVoter","addVote","castVote"] | sort)) and (.modes | all((.description | type == "string" and length > 0) and (.response | type == "string")))' 'expected complete mode catalog with descriptions'
dvlive_output catalog
