# DVLive

- `supabase/functions/_shared/sdk/`: TypeScript package `@digitalvirgo/dvlive-api`, with typed responses and HTTP metadata.
- `runner/`: original Node.js runner, client, configuration, and OpenAPI specification.
- `supabase/`: **DVLive** Edge Function, original Bravigo auth proxy and backend configuration.
- `script/`: individual smoke tests; `add-vote` calls DV Live directly, other voting operations use Supabase.

## App Expo (React Native)

La cartella `frontend/` contiene l’app Expo SDK 54 per web, iOS e Android, con
inizializzazione SmartUser nel client come in Bravigo.

```sh
cd frontend
npm install
npm run web
```

Expo carica `frontend/.env` automaticamente. Il sito è normalmente su
`http://localhost:8081`. La vecchia applicazione Vite/Express è stata sostituita.
Setup e flussi sono descritti in [frontend/README.md](frontend/README.md).
Il client Expo usa il nuovo contratto API (JWT su tutti i comandi, envelope
`{ ok, data }`, token DV Live nei secret del backend). La Edge Function e gli
smoke script locali descritti sotto sono allineati allo stesso contratto.

## Runner

```sh
cd runner
npm run help
npm run getShowVote
```

The existing local configuration is in `runner/config.json` (ignored by Git).
See [runner/README.md](runner/README.md) for all available actions.

## Edge Function

Endpoint: `https://<project-ref>.supabase.co/functions/v1/dvlive`.
Supabase JWT verification depends on `verify_jwt` in `supabase/config.toml`
(currently `false`). Smoke tests still send the Supabase headers.
Set `DVLIVE_API_TOKEN` in `supabase/.env` or Supabase secrets, without a
`Bearer` prefix. The function attaches it to upstream requests. Clients send
`apikey` and `Authorization: Bearer <app access_token>` for all five commands;
never send `bearer-token`. The catalog requires no JWT or server configuration.

The Edge Function uses the SDK's `parseMode` to convert the query parameter
into the `ApiModes` enum. If `mode` is missing, empty, or unrecognized, it returns
HTTP `200` with all modes, English descriptions, HTTP methods, required query
parameters, JSON fields, and response types. The catalog comes directly
from the SDK and does not require a DV Live token or environment configuration.
Mapped SDK response data is returned as `{ "ok": true, "data": ... }`, preserving
the original HTTP status. Errors use `{ "ok": false, "error": { "message", "code", "details" } }`.

| mode | Method | Query parameters besides `mode` | JSON body | Response |
| --- | --- | --- | --- | --- |
| `getShowVoteChoice` | GET | `uuid` | — | Participant, status, images, rounds |
| `getShowVote` | GET | `uuid` | — | Show, dates, and current round with participants |
| `getVoter` | GET | `showVoteUuid` | — | Voter, balance, fraud status |
| `createVoter` | POST | `showVoteUuid` | Optional `email`, `phone` | Registration result |
| `castVote` | POST | `showVoteUuid` | Required `votes`, optional fraud prevention fields | Voting result and remaining votes, when provided |

`votes` is a non-empty array of `{ "choiceUuid": "...", "nbVotes": 1 }`.
The fraud prevention fields are `sessionToken`, `phoneFingerPrint`, `ip`, `userAgent`,
and `uniqSubscriptionId`. The SDK validates the body, field types, enums, and vote values before the HTTP request; other constraints are checked by the upstream API.
For POST requests, send `Content-Type: application/json`; query parameters do not belong in the body.

```sh
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=getShowVote&uuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY"

curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=castVote&showVoteUuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"votes":[{"choiceUuid":"CHOICE_UUID","nbVotes":1}]}'
```

### Bravigo authentication

`supabase/functions/bolt-auth-proxy/index.ts`, its `deno.json` and
`_shared/resolve-product.ts` are copied unchanged from Bravigo. The frontend
`resolveUser.ts`, `supabase.ts`, `traceFetch.ts` and `logger.ts` are also copied
unchanged; `appConfig.ts` adapts the existing local Expo configuration.

The flow is `SmartUser login/signup → N token → syncUser → app JWT → DVLive`.
The local service slug is `dvlive`: the proxy selects `DVLIVE_SMART_USER_APP_ID`
and `DVLIVE_SMART_USER_APP_SECRET` from `supabase/.env`, plus `SMART_USER_APP_ENV`.
Frontend SmartUser credentials remain separate, in `frontend/.env`.
Real secrets belong in the ignored `.env` files, never `.env.example`.
The proxy `.npmrc` references `NPM_TOKEN` from the server environment.

As in Bravigo, a configured `APP_JWT_SECRET` (fallback `SUPABASE_JWT_SECRET`)
selects the custom HS256 JWT path. Without either key, the original proxy uses
Supabase Auth to create/reuse the local user and return a GoTrue access token.
DVLive uses the unchanged Bravigo `verify-app-jwt.ts`: it verifies HS256 tokens
with `APP_JWT_SECRET`, falling back to `SUPABASE_JWT_SECRET`. This verifier
requires a signing secret even when the proxy uses GoTrue; a GoTrue token must
be HS256-signed with the matching secret. There is no `/auth/v1/user` fallback.

All commands require the app JWT in `Authorization`. `dvlive/index.ts` verifies
its signature and requires `app_role=app_user` and `absolute_reference`, accepting
flat claims or `app_metadata`. The verified `absolute_reference` supplies
`userRef`/`uniqRef`; `sub` is the internal profile UUID. Caller references cannot
override that identity. The SDK catalog describes SDK parameters; the adapter
fills user identity. The auth proxy remains unchanged.

The bootstrap migration `20261102000300_dvlive_auth.sql` installs the three auth
tables from the Bravigo baseline and seeds the local service directly as `dvlive`.
It preserves the Bravigo service/product IDs. This is the auth schema subset,
not the entire Bravigo backoffice database.
`20261103160000_align_jwt_claim_helpers.sql` aligns JWT claim extraction with
the Bravigo baseline, including fallback for empty root claims to `app_metadata`.

```sh
supabase migration up --local
supabase functions serve --env-file supabase/.env
```

Restart the function server and Expo after changing their `.env` files.
To move DVLive to Bravigo, copy `functions/dvlive` and the local SDK at the same
relative path; enable `functions.dvlive` with `verify_jwt = false`, configure
`DVLIVE_ENV`, and use Bravigo's existing proxy, schema and app JWT. Do not apply
the local DVLive bootstrap migration to an existing Bravigo database.

### Local environment and deployment

`supabase/.env` contains `DVLIVE_ENV`, set to `STAG` or `PROD`:

```dotenv
DVLIVE_ENV=STAG
DVLIVE_API_TOKEN=<server-only-dvlive-api-token>
```

Optional SDK logging is configured in the same `supabase/.env` file:

```dotenv
DVLIVE_LOG_ENABLE=TRUE
DVLIVE_LOG_LEVEL=DEBUG
```

Missing keys default to logging disabled (`FALSE`) and level `WARNING`.
Supported levels are `WARNING`, `INFO`, and `DEBUG`. The Edge Function passes
these settings to the SDK; output appears in the Supabase function terminal/logs.
See [SDK logging](supabase/functions/_shared/sdk/README.md#logging) for details. The local template keeps
logging disabled until explicitly enabled.

The SDK selects the base URL according to the environment: `STAG` uses
`https://dev-webshow-engine.dv-live.com`, while `PROD` uses
`https://webshow-engine.dv-live.com`. The mapping is internal to the SDK. A missing value or a value other than
`STAG` or `PROD` results in an HTTP 500 configuration error for operation requests.
The catalog remains available without configuration.
The file is ignored by Git; on a fresh checkout, copy it from `supabase/.env.example`.

With the Supabase CLI and Docker available, run from the repository root:

```sh
supabase start
supabase functions serve --env-file supabase/.env
```

To deploy to your project:

```sh
supabase secrets set --env-file supabase/.env --project-ref PROJECT_REF
supabase functions deploy dvlive --project-ref PROJECT_REF
```

The `.env` file is passed explicitly using `--env-file`, as described in the
[Supabase documentation](https://supabase.com/docs/guides/functions/secrets).
The gateway JWT configuration is kept as defined in `supabase/config.toml`.

## SDK

The Edge Function uses `@digitalvirgo/dvlive-api` through the local mapping in
`supabase/functions/dvlive/deno.json`. The package does not need to be published to serve
the function locally or include it in a deployment.

```ts
import { ApiService } from "@digitalvirgo/dvlive-api";

const api = new ApiService({
  environment: "STAG", // The Edge Function reads this value from DVLIVE_ENV.
  headers: () => ({ Authorization: `Bearer ${token}` }),
});
const result = await api.getShowVote(uuid);
// result.data: ShowVote; result.status: number; result.headers: Headers
return json({ ok: true, data: result.data }, result.status);
```

The SDK wrapper remains internal; the adapter wraps mapped `result.data` in the API response envelope.
The SDK decodes DV Live responses in `supabase/functions/_shared/sdk/src/responses/`, then converts them
into public model instances through their static `fromResponse()` factories in
`supabase/functions/_shared/sdk/src/models/`. Customize output fields and transformations in those factories;
the Edge Function receives and serializes the resulting model.
Current models keep existing field names and omit additional upstream properties.
Malformed response fields are rejected before DTO conversion.
The actual status code is preserved. HTTP errors retain their original status, with upstream payloads in `error.details`;
request parameter or body validation errors become `400`, network or decoding errors become `502`, and timeouts become `504`.
The default timeout is 15 seconds; no automatic retries are performed.

Package structure, interfaces, errors, and usage: [supabase/functions/_shared/sdk/README.md](supabase/functions/_shared/sdk/README.md).

## Smoke tests

The scripts follow the `atom` conventions: one Bash file per mode, a shared helper,
and local variables editable at the start of each test. They require `curl` and `jq`.

```sh
# Set shared credentials and show UUID in script/config.json.
# Set the identifiers in each test's local configuration block.
./script/smoke-get-show-vote.sh
./script/smoke-get-show-vote-choice.sh
./script/smoke-get-voter.sh
```

No `export` is needed. For remote Supabase, set `SUPABASE_URL` and
`SUPABASE_ANON_KEY` and SmartUser login configuration in `script/config.json`.
Locally, the default URL is `http://127.0.0.1:54321`; the key is resolved
as in `atom`: from the environment, then `supabase status -o json`, then the local demo key.
The DV Live token belongs in the server secret `DVLIVE_API_TOKEN`.
`DVLIVE_BEARER_TOKEN` in script config is used only by direct add-vote.

Details, POST scripts, and available variables: [script/README.md](script/README.md).
SDK tests use mocked HTTP responses and run separately from the live smoke tests:

```sh
npm ci --prefix supabase/functions/_shared/sdk
npm --prefix supabase/functions/_shared/sdk test
```

Vote crediting is available only through `bash script/smoke-add-vote.sh`, which uses
local DV Live environment/bearer configuration and calls the upstream API directly with curl.
It is not exposed by the SDK, Edge Function, or reference runner.
