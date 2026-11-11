# DV Live web show engine — API reference

**Source:** `openapi.json` (OpenAPI 3.0)  
**Title:** DVLive web show engine — votes, participants

---

## Authentication

- **Required in both modes:** `Authorization: Bearer <DVLIVE_API_TOKEN>`
- **Optional in PROD:** `X-Internal-Auth: <DVLIVE_ALB_TOKEN_environment>`

`DVLIVE_MODE=PROD` (also the default when absent) selects the external host and
`DVLIVE_ALB_TOKEN_<environment>` using `DVLIVE_ENV` (`DEV`, `STAG`, `PROD`).
`DVLIVE_MODE=INT` selects the same environment with an `int-` host prefix and
sends only `Authorization: Bearer <DVLIVE_API_TOKEN>`, ignoring ALB tokens.
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
| `getShowVoteChoice` | `GET /show-vote-choice/{uuid}` | `client.showVoteChoices.get(uuid)` |
| `getShowVote` | `GET /show-vote/{uuid}` | `client.showVotes.get(uuid)` |
| `createVoter` | `POST /show-vote/{uuid}/voter` | `client.voters.create(showVoteUuid, body)` |
| `getVoter` | `GET /show-vote/{uuid}/voter/{userRef}` | `client.voters.get(showVoteUuid, userRef)` |
| `castVote` | `POST /show-vote/{uuid}/voter/{uniqRef}/vote` | `client.voters.castVote(...)` |

Path parameter `userRef` / `uniqRef` is the voter’s `uniqRef` from `CreateVoterRequest`.

---

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

For vote crediting, use the standalone `../script/smoke-add-vote.sh` direct-curl smoke test.
The upstream OpenAPI retains the endpoint for reference.
