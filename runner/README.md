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

2. Set `DVLIVE_MODE` to `INT` or `PROD` (default when absent).
   Set `DVLIVE_ENV` to `DEV`, `STAG` or `PROD` and provide a nonblank
   `DVLIVE_API_TOKEN_<environment>`, always sent as `Authorization: Bearer <selected-api-token>`.
   `INT` uses the internal `int-` hosts and ignores ALB tokens.
   `PROD` selects the external host and also sends `X-Internal-Auth` when the
   matching `DVLIVE_ALB_TOKEN_<environment>` is nonblank.
   The suffix must match `DVLIVE_ENV`: `DVLIVE_API_TOKEN_DEV`,
   `DVLIVE_API_TOKEN_STAG` or `DVLIVE_API_TOKEN_PROD`. Only that token is read;
   the old `DVLIVE_API_TOKEN` key is ignored. Environment variables override
   these JSON settings, including blank values (which fail validation).

   ```json
   {
     "DVLIVE_MODE": "PROD",
     "DVLIVE_ENV": "STAG",
     "DVLIVE_API_TOKEN_STAG": "…",
     "DVLIVE_ALB_TOKEN_STAG": "…",
     "action": "getShowVote",
     "showVote": { "uuid": "…" }
   }
   ```

## Usage

```bash
npm run help               # summary of all actions
npm run help -- getVoter   # detail for one action

npm run getShowVoteChoice  # participant + voter balance + current round (3 GETs)
npm run getShowVote        # GET  /show-vote/{uuid}
npm run createVoter        # POST /show-vote/{uuid}/voter
npm run getVoter           # GET  /show-vote/{uuid}/voter/{userRef}
npm run addVote            # POST .../add-vote (credit points)
npm run castVote           # POST .../vote

npm start                  # uses config.action
npm start -- getVoter      # CLI arg overrides config.action
node run.js getShowVote
```

Each run prints a curl command including the actual authentication value, the call signature, the full JSON response, and a short summary where useful.

## Configuration reference

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `DVLIVE_MODE` | string | no | `INT` or `PROD`; defaults to `PROD`. Invalid values fail configuration. |
| `DVLIVE_ENV` | string | yes | `DEV`, `STAG` or `PROD`; selects the API environment independently of access mode. |
| `DVLIVE_API_TOKEN_<environment>` | string | yes | Nonblank bearer token required in both INT and PROD modes. |
| `DVLIVE_ALB_TOKEN_DEV` | string | no | DEV `X-Internal-Auth` token in `PROD` mode. |
| `DVLIVE_ALB_TOKEN_STAG` | string | no | STAG `X-Internal-Auth` token in `PROD` mode. |
| `DVLIVE_ALB_TOKEN_PROD` | string | no | PROD `X-Internal-Auth` token in `PROD` mode. |
| `action` | string | no | Default action; overridden by CLI arg. |
| `showVote.uuid` | string | yes for `getShowVote` | Show vote UUID. |
| `showVoteChoice.uuid` | string | yes for `getShowVoteChoice` | Choice/participant UUID. |
| `showVoteChoice.userRef` | string | yes for `getShowVoteChoice` | Voter reference used to fetch the balance. |
| `createVoter.showVoteUuid` | string | yes for `createVoter` | Path UUID. |
| `createVoter.email` | string | no | Request body. |
| `createVoter.phone` | string | no | Request body. |
| `createVoter.uniqRef` | string | no | Request body. |
| `getVoter.showVoteUuid` | string | yes for `getVoter` | Path UUID. |
| `getVoter.userRef` | string | yes for `getVoter` | Voter uniqRef (path). |
| `addVote.showVoteUuid` | string | yes for `addVote` | Path UUID. |
| `addVote.userRef` | string | yes for `addVote` | Voter uniqRef (path). |
| `addVote.additionalVoteType` | string | yes for `addVote` | `PURCHASE`, `SPONSOR`, `VIDEO`, `GAME`, `REFERAL` or `PROMO`. |
| `addVote.uniqueTransactionId` | string | yes for `addVote` | Nonblank transaction identifier for the credit operation. |
| `addVote.nbPoints` | integer | yes for `addVote` | Positive number of points to credit. |
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
| `getShowVoteChoice` | `GET /show-vote-choice/{uuid}` | `client.showVoteChoices.get(uuid, userRef)` |
| `getShowVote` | `GET /show-vote/{uuid}` | `client.showVotes.get(uuid)` |
| `createVoter` | `POST /show-vote/{uuid}/voter` | `client.voters.create(showVoteUuid, body)` |
| `getVoter` | `GET /show-vote/{uuid}/voter/{userRef}` | `client.voters.get(showVoteUuid, userRef)` |
| `addVote` | `POST .../add-vote` | `client.voters.addVote(showVoteUuid, userRef, body)` |
| `castVote` | `POST .../vote` | `client.voters.castVote(showVoteUuid, uniqRef, body)` |

`getShowVoteChoice` composes three upstream GET requests: it fetches the choice,
then fetches the voter and show in parallel using the returned `showVoteUuid`.
Set `showVoteChoice.userRef` to the voter reference (the same `absolute_reference`
used by the app JWT when calling the Edge Function). The result adds `balance`,
`remainingPoints`, and `round: { startDay, endDay }` or `null` when no round exists.
Any upstream failure fails the action. The runner calls upstream directly, so it
requires the reference in configuration; the Edge Function derives it from the
verified JWT. `openapi.json` describes the individual upstream endpoints.

## Files

- `run.js` — entry point; loads config, picks an action, dispatches.
- `dvliveClient.js` — HTTP client + typed errors (`DvliveAuthError`, `DvliveForbiddenError`, `DvliveNotFoundError`, `DvliveConflictError`, `DvliveValidationError`, `DvliveRateLimitError`, `DvliveError`).
- `dvlive-api.md` — short API notes aligned with `openapi.json`.
- `openapi.json` — OpenAPI spec.
- `config.example.json` — template configuration.
- `config.json` — real configuration; **gitignored** (may contain tokens).

For vote crediting, add an `addVote` section to `config.json` and run `npm run addVote`:

```json
"addVote": {
  "uniqueTransactionId": "credit-ozzy-001-video-0001",
  "showVoteUuid": "00000000-0000-4000-8000-000000000001",
  "userRef": "ozzy-001",
  "additionalVoteType": "VIDEO",
  "nbPoints": 1
}
```

Set `uniqueTransactionId` to an identifier for the credit transaction.
Use a new identifier for each new credit operation.

This credits points to the voter; `castVote` spends them on choices.
The standalone `../script/smoke-add-vote.sh` direct-curl smoke test is also available.

The external hosts are `dev-webshow-engine.dv-live.com` (DEV),
`stag-webshow-engine.dv-live.com` (STAG) and `webshow-engine.dv-live.com` (PROD).
External ALB access currently allows GET and HEAD. `createVoter`, `addVote` and `castVote`
use POST and require POST to be enabled by the service owner.

Run mocked checks without calling the upstream service with `npm test`.
