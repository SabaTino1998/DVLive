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

2. Set `baseUrl` and `bearerToken` (HTTP Bearer). All OpenAPI endpoints require a valid token.

   ```json
   {
     "baseUrl": "https://your-dvlive-api.example.com",
     "bearerToken": "…",
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
npm run addVote            # POST .../add-vote
npm run castVote           # POST .../vote

npm start                  # uses config.action
npm start -- getVoter      # CLI arg overrides config.action
node run.js getShowVote
```

Each run prints the call signature, the full JSON response, and a short summary where useful.

## Configuration reference

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `baseUrl` | string | yes | API base URL (no trailing slash). |
| `bearerToken` | string | yes (prod) | Bearer token for `Authorization`. |
| `action` | string | no | Default action; overridden by CLI arg. |
| `showVote.uuid` | string | yes for `getShowVote` | Show vote UUID. |
| `showVoteChoice.uuid` | string | yes for `getShowVoteChoice` | Choice/participant UUID. |
| `createVoter.showVoteUuid` | string | yes for `createVoter` | Path UUID. |
| `createVoter.email` | string | no | Request body. |
| `createVoter.phone` | string | no | Request body. |
| `createVoter.uniqRef` | string | no | Request body. |
| `getVoter.showVoteUuid` | string | yes for `getVoter` | Path UUID. |
| `getVoter.userRef` | string | yes for `getVoter` | Voter uniqRef (path). |
| `addVote.showVoteUuid` | string | yes for `addVote` | Path UUID. |
| `addVote.userRef` | string | yes for `addVote` | Voter uniqRef (path). |
| `addVote.additionalVoteType` | string | no | Body (`VIDEO`, `PURCHASE`, …). |
| `addVote.nbPoints` | integer | no | Body. |
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
| `addVote` | `POST .../add-vote` | `client.voters.addVote(showVoteUuid, uniqRef, body)` |
| `castVote` | `POST .../vote` | `client.voters.castVote(showVoteUuid, uniqRef, body)` |

## Files

- `run.js` — entry point; loads config, picks an action, dispatches.
- `dvliveClient.js` — HTTP client + typed errors (`DvliveAuthError`, `DvliveForbiddenError`, `DvliveNotFoundError`, `DvliveConflictError`, `DvliveValidationError`, `DvliveRateLimitError`, `DvliveError`).
- `dvlive-api.md` — short API notes aligned with `openapi.json`.
- `openapi.json` — OpenAPI spec.
- `config.example.json` — template configuration.
- `config.json` — real configuration; **gitignored** (may contain tokens).
