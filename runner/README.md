# dvlive-runner — DV Live web show engine

A tiny Node.js script that calls the **DV Live web show engine** API from the command line using `config.json`.

It mirrors the Smart Journey reference runner (`smart-journey/runner/`): one HTTP client (`dvliveClient.js`) and one dispatcher (`run.js`).

## Requirements

- Node.js >= 18 (uses the built-in `fetch`)

## Setup

1. Copy the example config and edit it:

   ```bash
   cp config.example.json config.json
   ```

2. Set `DVLIVE_MODE` to `LOCAL` or `PROD` (default when absent).
   `LOCAL` uses the internal `int-` hosts with `Authorization: Bearer dev-auth-token`
   and ignores ALB tokens. In `PROD`, set `DVLIVE_ENV` to `DEV`, `STAG` or `PROD` and the matching
   `DVLIVE_ALB_TOKEN_<environment>`. The runner selects the external host and
   sends only `X-Internal-Auth` in `PROD`; a missing or blank token omits the header.
   Environment variables override these JSON settings.

   ```json
   {
     "DVLIVE_MODE": "PROD",
     "DVLIVE_ENV": "STAG",
     "DVLIVE_ALB_TOKEN_STAG": "…",
     "action": "getShowVote",
     "showVote": { "uuid": "…" }
   }
   ```

## Usage

```bash
npm run help               # summary of all actions
npm run help -- getVoter   # detail for one action

npm run getShowVoteChoice  # GET  /show-vote-choice/{uuid}
npm run getShowVote        # GET  /show-vote/{uuid}
npm run createVoter        # POST /show-vote/{uuid}/voter
npm run getVoter           # GET  /show-vote/{uuid}/voter/{userRef}
npm run castVote           # POST .../vote

npm start                  # uses config.action
npm start -- getVoter      # CLI arg overrides config.action
node run.js getShowVote
```

Each run prints a curl command including the actual authentication value, the call signature, the full JSON response, and a short summary where useful.

## Configuration reference

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `DVLIVE_MODE` | string | no | `LOCAL` or `PROD`; defaults to `PROD`. Invalid values fail configuration. |
| `DVLIVE_ENV` | string | yes | `DEV`, `STAG` or `PROD`; selects the API environment independently of access mode. |
| `DVLIVE_ALB_TOKEN_DEV` | string | no | DEV `X-Internal-Auth` token in `PROD` mode. |
| `DVLIVE_ALB_TOKEN_STAG` | string | no | STAG `X-Internal-Auth` token in `PROD` mode. |
| `DVLIVE_ALB_TOKEN_PROD` | string | no | PROD `X-Internal-Auth` token in `PROD` mode. |
| `action` | string | no | Default action; overridden by CLI arg. |
| `showVote.uuid` | string | yes for `getShowVote` | Show vote UUID. |
| `showVoteChoice.uuid` | string | yes for `getShowVoteChoice` | Choice/participant UUID. |
| `createVoter.showVoteUuid` | string | yes for `createVoter` | Path UUID. |
| `createVoter.email` | string | no | Request body. |
| `createVoter.phone` | string | no | Request body. |
| `createVoter.uniqRef` | string | no | Request body. |
| `getVoter.showVoteUuid` | string | yes for `getVoter` | Path UUID. |
| `getVoter.userRef` | string | yes for `getVoter` | Voter uniqRef (path). |
| `castVote.showVoteUuid` | string | yes for `castVote` | Path UUID. |
| `castVote.userRef` | string | yes for `castVote` | Voter uniqRef (path). |
| `castVote.votes` | array | yes for `castVote` | Body: `{ choiceUuid, nbVotes }[]`. |
| `castVote.sessionToken` | string | no | Antifraud body fields. |
| `castVote.phoneFingerPrint` | string | no | Antifraud body fields. |
| `castVote.ip` | string | no | Antifraud body fields. |
| `castVote.userAgent` | string | no | Antifraud body fields. |
| `castVote.uniqSubscriptionId` | string | no | Antifraud body fields. |

For POST actions, path fields (`showVoteUuid`, `userRef`) are stripped from the JSON body automatically.

## Supported actions

| Action | HTTP | Method on client |
| --- | --- | --- |
| `getShowVoteChoice` | `GET /show-vote-choice/{uuid}` | `client.showVoteChoices.get(uuid)` |
| `getShowVote` | `GET /show-vote/{uuid}` | `client.showVotes.get(uuid)` |
| `createVoter` | `POST /show-vote/{uuid}/voter` | `client.voters.create(showVoteUuid, body)` |
| `getVoter` | `GET /show-vote/{uuid}/voter/{userRef}` | `client.voters.get(showVoteUuid, userRef)` |
| `castVote` | `POST .../vote` | `client.voters.castVote(showVoteUuid, uniqRef, body)` |

## Files

- `run.js` — entry point; loads config, picks an action, dispatches.
- `dvliveClient.js` — HTTP client + typed errors (`DvliveAuthError`, `DvliveForbiddenError`, `DvliveNotFoundError`, `DvliveConflictError`, `DvliveValidationError`, `DvliveRateLimitError`, `DvliveError`).
- `dvlive-api.md` — short API notes aligned with `openapi.json`.
- `openapi.json` — OpenAPI spec.
- `config.example.json` — template configuration.
- `config.json` — real configuration; **gitignored** (may contain tokens).

For vote crediting, use the standalone `../script/smoke-add-vote.sh` direct-curl smoke test.
The upstream OpenAPI retains the endpoint for reference.

The external hosts are `dev-webshow-engine.dv-live.com` (DEV),
`stag-webshow-engine.dv-live.com` (STAG) and `webshow-engine.dv-live.com` (PROD).
External ALB access currently allows GET and HEAD. `createVoter` and `castVote`
use POST and require POST to be enabled by the service owner.

Run mocked checks without calling the upstream service with `npm test`.
