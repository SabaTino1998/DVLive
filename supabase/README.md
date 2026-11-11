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
| `getVoter` | GET | `showVoteUuid` | — | Voter details, balance, and fraud status |
| `createVoter` | POST | `showVoteUuid` | Optional fields: `email`, `phone` | Registration result |
| `castVote` | POST | `showVoteUuid` | Required `votes`; optional fraud prevention fields | Voting result and `nbVoteRemaining`, when provided |

For `getShowVote`, `uuid` identifies the show vote; for `getShowVoteChoice`,
it identifies the participant. Callers do not send `userRef` or `uniqRef`.
For `getVoter`, `createVoter`, and `castVote`, the function takes voter identity
from the verified app JWT claim `absolute_reference` (flat or in `app_metadata`).
`sub` is the internal profile UUID. Caller references cannot override that identity.
The function does not automatically retrieve the show UUID or manage its lifecycle
across rounds.

`votes` must be a non-empty array of objects such as
`{ "choiceUuid": "PARTICIPANT_UUID", "nbVotes": 1 }`.
The optional fraud prevention fields are `sessionToken`, `phoneFingerPrint`,
`ip`, `userAgent`, and `uniqSubscriptionId`.

POST requests require `Content-Type: application/json`. Query parameters must
not be moved into the body. The SDK selects supported JSON fields and ignores
additional ones.

If `mode` is missing, empty, or unknown, the function returns HTTP 200 with the
SDK operation catalog, including for POST requests. The catalog does not require
an app JWT, a DV Live token, a JSON body, or environment configuration.

Vote crediting through `add-vote` is not exposed by this function; the corresponding
[smoke script](../script/README.md) calls DV Live directly.

## Authentication

Every request for a recognized operation must include:

```http
Authorization: Bearer <app access_token>
apikey: <supabase-anon-or-publishable-key>
```

The app JWT is issued by `bolt-auth-proxy` after SmartUser login/signup and
`syncUser`. The function verifies the HS256 signature with `APP_JWT_SECRET`
(fallback `SUPABASE_JWT_SECRET`), and requires `app_role=app_user` and a
nonempty `absolute_reference`. Missing or invalid JWT returns `AUTH_REQUIRED`
(401). Invalid app claims or a missing `absolute_reference` return `FORBIDDEN`
(403).

`DVLIVE_API_TOKEN` is required in both modes and is always sent as
`Authorization: Bearer <DVLIVE_API_TOKEN>`.
In `DVLIVE_MODE=PROD` (default when absent), DVLive upstream requests also use
`X-Internal-Auth` when the environment-specific ALB secret is configured.
In `DVLIVE_MODE=INT`, the SDK selects the corresponding host with an `int-`
prefix and the function sends only `Authorization: Bearer <DVLIVE_API_TOKEN>`,
without reading or forwarding ALB tokens. The caller app JWT is verified
by the Edge Function and never forwarded upstream.

In `PROD` mode, optional ALB tokens (`DVLIVE_ALB_TOKEN_DEV`, `DVLIVE_ALB_TOKEN_STAG`,
`DVLIVE_ALB_TOKEN_PROD`) set `X-Internal-Auth` on upstream calls. The webshow
ALB allows a request only when both the `Host` header and this token match; a
missing token returns upstream HTTP 404. Selection is by the SDK host, so a
`DVLIVE_ENV=STAG` deployment calls `stag-webshow-engine.dv-live.com` and uses
`DVLIVE_ALB_TOKEN_STAG`. Leave the secrets unset to omit the header.

Supabase gateway authentication is separate. Currently, [config.toml](config.toml)
sets `verify_jwt = false` for this function. For requests to a remote project,
still send the Supabase headers required by the gateway and the project's key type.

## Local examples

The following commands assume that `$SUPABASE_JWT` (app access token) and
`$SUPABASE_ANON_KEY` are already set in the shell. Replace placeholder
identifiers with values from your test environment.

```sh
# Operation catalog
curl 'http://127.0.0.1:54321/functions/v1/dvlive'

# Show and current round
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=getShowVote&uuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Register a voter
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=createVoter&showVoteUuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"email":"voter@example.com"}'

# Cast a vote
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=castVote&showVoteUuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"votes":[{"choiceUuid":"CHOICE_UUID","nbVotes":1}]}'
```

Registering a voter and casting a vote modify data in the selected environment.

## Configuration and local setup

Run commands from the repository root, with Supabase CLI and Docker available.
If `supabase/.env` does not exist, create it by copying
[`.env.example`](.env.example). Preserve any existing local settings.

```dotenv
DVLIVE_MODE=PROD
DVLIVE_API_TOKEN=<api-token>
DVLIVE_ENV=STAG
# DVLIVE_ALB_TOKEN_DEV=<alb-token-for-dev-webshow-engine>
# DVLIVE_ALB_TOKEN_STAG=<alb-token-for-stag-webshow-engine>
# DVLIVE_ALB_TOKEN_PROD=<alb-token-for-webshow-engine>
DVLIVE_LOG_ENABLE=FALSE
DVLIVE_LOG_LEVEL=WARNING
```

- `DVLIVE_MODE`: `INT` or `PROD`, default `PROD` when absent. Invalid values return HTTP 500.
  This access mode is independent of the API environment.
- `DVLIVE_API_TOKEN`: required, nonblank upstream bearer token in both INT and PROD modes.
  Missing or blank returns HTTP 500 before upstream requests; ignored in PROD.
- `DVLIVE_ENV`: `DEV`, `STAG` or `PROD`. The SDK selects the corresponding DV Live URL;
  a missing or unsupported value produces HTTP 500 for operation requests.
- `DVLIVE_ALB_TOKEN_DEV`, `DVLIVE_ALB_TOKEN_STAG`, `DVLIVE_ALB_TOKEN_PROD`:
  optional PROD-mode ALB tokens for `X-Internal-Auth`, selected directly by `DVLIVE_ENV` and passed through the SDK `headers` option. Unset or blank omits the header.
- `DVLIVE_LOG_ENABLE`: `TRUE` enables SDK logging; the default is `FALSE`.
- `DVLIVE_LOG_LEVEL`: `WARNING`, `INFO`, or `DEBUG`; the default is `WARNING`.
  The level is ignored when logging is disabled.

```sh
supabase start
supabase functions serve --env-file supabase/.env
```

Logs appear in the local server terminal or, after deployment, in the function
logs in the Supabase dashboard. `INFO` adds request details and durations;
`DEBUG` also includes sanitized bodies. The SDK omits authentication headers
and redacts sensitive data. Restart the server after changing the `.env` file.

The mapping in [deno.json](functions/dvlive/deno.json) points to
`../_shared/dvlive-sdk/src/index.ts`. The SDK lives in
[`functions/_shared/dvlive-sdk`](functions/_shared/dvlive-sdk), alongside the Edge Functions,
so local serving and deployment use the shared source without npm publication
or a prebuilt `dist/` directory.

## Deployment

From the repository root, with access to the Supabase project:

```sh
supabase secrets set --env-file supabase/.env --project-ref PROJECT_REF
supabase functions deploy dvlive --project-ref PROJECT_REF
```

The file passed to `secrets set` must contain the server configuration described
above, including `DVLIVE_ALB_TOKEN_DEV`, `DVLIVE_ALB_TOKEN_STAG`, `DVLIVE_ALB_TOKEN_PROD` (selected by `DVLIVE_ENV`). Deployment uses the gateway
configuration in [config.toml](config.toml) and the actual SDK mapping in `deno.json`.

## Responses and errors

Successful responses wrap the public model returned by the SDK in
`{ "ok": true, "data": ... }` and preserve the DV Live HTTP status.
Errors use `{ "ok": false, "error": { "message", "code", "details" } }`.

| Status | Meaning |
| --- | --- |
| `200` | Catalog; operation responses preserve the upstream success status |
| `200` | CORS preflight (`OPTIONS`) |
| `400` | Malformed JSON or parameter/body validation error |
| `401` | Missing or invalid app JWT (`AUTH_REQUIRED`) |
| `403` | Invalid app claims or missing `absolute_reference` (`FORBIDDEN`) |
| `405` | Incorrect method for the mode; the response includes `Allow` |
| `415` | Unsupported content type for a POST request |
| `500` | Missing or invalid SDK configuration (`SERVER_MISCONFIGURED`) or unexpected internal error |
| `502` | Network error or DV Live response decoding failure |
| `504` | DV Live request timeout |

HTTP errors returned by DV Live retain their original status, with upstream
payloads in `error.details` when available. All responses include CORS headers;
origin `*` and methods `GET`, `POST`, and `OPTIONS` are allowed. No automatic
retries are performed.

## Files and verification

- [functions/dvlive/index.ts](functions/dvlive/index.ts): HTTP handler and SDK dispatch.
- [functions/dvlive/deno.json](functions/dvlive/deno.json): SDK import and strict TypeScript settings.
- [config.toml](config.toml): entrypoint and gateway configuration.
- [.env.example](.env.example): sample local configuration.

To verify individual operations against a running function, configure and run
the [smoke tests](../script/README.md). SDK tests using mocked HTTP responses are
described in the [SDK README](functions/_shared/dvlive-sdk/README.md).
