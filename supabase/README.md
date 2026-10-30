# DVLive Edge Function

The `dvlive` Edge Function exposes a single HTTP endpoint to retrieve a show,
read participant details, register a voter, check their balance, and cast votes.
It acts as an adapter between the application and the DV Live APIs through the
`@digitalvirgo/dvlive-api` SDK.

The function handles query strings, JSON bodies, authentication headers, CORS,
and HTTP responses. The SDK handles data validation, DV Live environment selection,
HTTP requests, and conversion of responses into public models.

## Endpoint and operations

```text
Local:      http://127.0.0.1:54321/functions/v1/dvlive
Deployed:   https://<project-ref>.supabase.co/functions/v1/dvlive
```

Select the operation using the case-sensitive `mode` query parameter.
Identifiers must also be passed in the query string.

| `mode` | Method | Query parameters besides `mode` | JSON body | Result |
| --- | --- | --- | --- | --- |
| `getShowVote` | GET | `uuid` | — | Show name and dates, current round, and participants |
| `getShowVoteChoice` | GET | `uuid` | — | Participant details, status, images, and rounds |
| `getVoter` | GET | `showVoteUuid`, `userRef` | — | Voter details, balance, and fraud status |
| `createVoter` | POST | `showVoteUuid` | Optional fields: `email`, `phone`, `uniqRef` | Registration result |
| `castVote` | POST | `showVoteUuid`, `userRef` | Required `votes`; optional fraud prevention fields | Voting result and `nbVoteRemaining`, when provided |

For `getShowVote`, `uuid` identifies the show vote; for `getShowVoteChoice`,
it identifies the participant. `userRef` is the voter reference.
The function receives these values from the caller: it does not automatically
retrieve the show UUID or manage its lifecycle across rounds.

`votes` must be a non-empty array of objects such as
`{ "choiceUuid": "PARTICIPANT_UUID", "nbVotes": 1 }`.
The optional fraud prevention fields are `sessionToken`, `phoneFingerPrint`,
`ip`, `userAgent`, and `uniqSubscriptionId`.

POST requests require `Content-Type: application/json`. Query parameters must
not be moved into the body. The SDK selects supported JSON fields and ignores
additional ones.

If `mode` is missing, empty, or unknown, the function returns HTTP 200 with the
SDK operation catalog, including for POST requests. The catalog does not require
a DV Live token, a JSON body, or environment configuration.

Vote crediting through `add-vote` is not exposed by this function; the corresponding
[smoke script](../script/README.md) calls DV Live directly.

## Authentication

Every request for a recognized operation must include:

```http
bearer-token: <dv-live-token>
```

The value must contain only the token, without the `Bearer` prefix. The function
forwards it to the DV Live API as `Authorization: Bearer <dv-live-token>`, keeping
it local to each request. Do not put this token in `supabase/.env`.
The function does not issue, retrieve, or refresh DV Live tokens.

Supabase authentication is separate: the caller's `Authorization` header is not
used as the DV Live token. Currently, [config.toml](config.toml) sets
`verify_jwt = false`, so the gateway does not verify the JWT for this function.
For requests to a remote project, use the Supabase headers required by the
gateway and the project's key type.

## Local examples

The following commands assume that `DVLIVE_BEARER_TOKEN` is already set in the
shell. Replace placeholder identifiers with values from your test environment.

```sh
# Operation catalog
curl 'http://127.0.0.1:54321/functions/v1/dvlive'

# Show and current round
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=getShowVote&uuid=SHOW_UUID' \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN"

# Register a voter
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=createVoter&showVoteUuid=SHOW_UUID' \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"uniqRef":"VOTER_REF"}'

# Cast a vote
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=castVote&showVoteUuid=SHOW_UUID&userRef=VOTER_REF' \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"votes":[{"choiceUuid":"CHOICE_UUID","nbVotes":1}]}'
```

Registering a voter and casting a vote modify data in the selected environment.

## Configuration and local setup

Run commands from the repository root, with Supabase CLI and Docker available.
If `supabase/.env` does not exist, create it by copying
[`.env.example`](.env.example). Preserve any existing local settings.

```dotenv
DVLIVE_ENV=STAG
DVLIVE_LOG_ENABLE=FALSE
DVLIVE_LOG_LEVEL=WARNING
```

- `DVLIVE_ENV`: `STAG` or `PROD`. The SDK selects the corresponding DV Live URL;
  a missing or unsupported value produces HTTP 500 for operation requests.
- `DVLIVE_LOG_ENABLE`: `TRUE` enables SDK logging; the default is `FALSE`.
- `DVLIVE_LOG_LEVEL`: `WARNING`, `INFO`, or `DEBUG`; the default is `WARNING`.
  The level is ignored when logging is disabled.

```sh
supabase start
supabase functions serve dvlive --env-file supabase/.env
```

Logs appear in the local server terminal or, after deployment, in the function
logs in the Supabase dashboard. `INFO` adds request details and durations;
`DEBUG` also includes sanitized bodies. The SDK omits authentication headers
and redacts sensitive data. Restart the server after changing the `.env` file.

The mapping in [deno.json](functions/dvlive/deno.json) points to
`../_shared/sdk/src/index.ts`. The SDK lives in
[`functions/_shared/sdk`](functions/_shared/sdk), alongside the Edge Functions,
so local serving and deployment use the shared source without npm publication
or a prebuilt `dist/` directory.

## Deployment

From the repository root, with access to the Supabase project:

```sh
supabase secrets set --env-file supabase/.env --project-ref PROJECT_REF
supabase functions deploy dvlive --project-ref PROJECT_REF
```

The file passed to `secrets set` must contain the server configuration described
above, without the caller's DV Live token. Deployment uses the gateway
configuration in [config.toml](config.toml) and the actual SDK mapping in `deno.json`.

## Responses and errors

Successful responses contain the public model returned by the SDK
(`result.data`) directly, without an additional wrapper, and preserve the DV Live
HTTP status.

| Status | Meaning |
| --- | --- |
| `200` | Catalog; operation responses preserve the upstream success status |
| `204` | CORS preflight (`OPTIONS`) |
| `400` | Malformed JSON or parameter/body validation error |
| `401` | Missing or empty `bearer-token` header, or upstream authentication error |
| `405` | Incorrect method for the mode; the response includes `Allow` |
| `415` | Unsupported content type for a POST request |
| `500` | Invalid SDK configuration or unexpected internal error |
| `502` | Network error or DV Live response decoding failure |
| `504` | DV Live request timeout |

HTTP errors returned by DV Live retain their original status and payload,
including text payloads. Errors generated by the adapter have the form
`{ "status": "error", "code": 400, "message": "..." }`.
All responses include CORS headers; origin `*` and methods `GET`, `POST`, and
`OPTIONS` are allowed. No automatic retries are performed.

## Files and verification

- [functions/dvlive/index.ts](functions/dvlive/index.ts): HTTP handler and SDK dispatch.
- [functions/dvlive/deno.json](functions/dvlive/deno.json): SDK import and strict TypeScript settings.
- [config.toml](config.toml): entrypoint and gateway configuration.
- [.env.example](.env.example): sample local configuration.

To verify individual operations against a running function, configure and run
the [smoke tests](../script/README.md). SDK tests using mocked HTTP responses are
described in the [SDK README](functions/_shared/sdk/README.md).
