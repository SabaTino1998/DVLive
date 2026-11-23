# DV Live web show engine — API reference

**Source:** `openapi.json` (OpenAPI 3.0)  
**Title:** DVLive web show engine — votes, participants

---

## Authentication

- **Required in both modes:** `Authorization: Bearer <selected-api-token>`
- **Optional in PROD:** `X-Internal-Auth: <DVLIVE_ALB_TOKEN_environment>`

`DVLIVE_MODE=PROD` (also the default when absent) selects the external host and
`DVLIVE_ALB_TOKEN_<environment>` using `DVLIVE_ENV` (`DEV`, `STAG`, `PROD`).
`DVLIVE_MODE=INT` selects the same environment with an `int-` host prefix and
sends only `Authorization: Bearer <selected-api-token>`, ignoring ALB tokens.
External access currently
allows GET and HEAD; POST operations require an ALB rule update.

---

## Reference runner

This folder mirrors the Smart Journey `runner/` layout:

| File | Role |
| --- | --- |
| `dvliveClient.js` | HTTP client + typed errors |
| `run.js` | Loads `config.json`, dispatches one action |
| `config.example.json` | Template configuration |
| `openapi.json` | OpenAPI spec |

```bash
cp config.example.json config.json
npm run help
npm run getShowVote
```

---

## Endpoints (runner actions)

| Action | HTTP | Client |
| --- | --- | --- |
| `getShowVoteChoice` | `GET /show-vote-choice/{uuid}` | `client.showVoteChoices.get(uuid, userRef)` |
| `getShowVote` | `GET /show-vote/{uuid}` | `client.showVotes.get(uuid)` |
| `createVoter` | `POST /show-vote/{uuid}/voter` | `client.voters.create(showVoteUuid, body)` |
| `getVoter` | `GET /show-vote/{uuid}/voter/{userRef}` | `client.voters.get(showVoteUuid, userRef)` |
| `addVote` | `POST /show-vote/{uuid}/voter/{userRef}/add-vote` | `client.voters.addVote(showVoteUuid, userRef, body)` |
| `castVote` | `POST /show-vote/{uuid}/voter/{uniqRef}/vote` | `client.voters.castVote(...)` |

Path parameter `userRef` / `uniqRef` is the voter’s `uniqRef` from `CreateVoterRequest`.

---

`getShowVoteChoice` composes three upstream GET requests: it fetches the choice,
then fetches the voter and show in parallel using the returned `showVoteUuid`.
Set `showVoteChoice.userRef` to the voter reference (the same `absolute_reference`
used by the app JWT when calling the Edge Function). The result adds `balance`,
`remainingPoints`, and `round: { startDay, endDay }` or `null` when no round exists.
Any upstream failure fails the action. The runner calls upstream directly, so it
requires the reference in configuration; the Edge Function derives it from the
verified JWT. `openapi.json` describes the individual upstream endpoints.

## Error envelope

Many error responses use **OperationResult**:

```json
{
  "status": "error",
  "code": 409,
  "message": "..."
}
```

Success responses for vote operations may include `nbVoteRemaining`.

See `components/schemas` in `openapi.json` for full request/response models.

For vote crediting, configure `addVote` (`showVoteUuid`, `userRef`,
`additionalVoteType`, positive integer `nbPoints`, nonblank `uniqueTransactionId`) and run `npm run addVote`.
The standalone `../script/smoke-add-vote.sh` direct-curl smoke test is also available.
