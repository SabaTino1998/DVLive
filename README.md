# DVLive

- `supabase/functions/_shared/sdk/`: TypeScript package `@digitalvirgo/dvlive-api`, with typed responses and HTTP metadata.
- `runner/`: original Node.js runner, client, configuration, and OpenAPI specification.
- `supabase/`: single **DVLive** Edge Function and backend configuration.
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
Pass the DV Live token with each operation request in the
`bearer-token: <token>` header (without the `Bearer` prefix), separately from the Supabase JWT.
The function forwards it to the DV Live API as `Authorization: Bearer <token>`.
It is not stored in the function's environment variables. The catalog does not require this header.

The Edge Function uses the SDK's `parseMode` to convert the query parameter
into the `ApiModes` enum. If `mode` is missing, empty, or unrecognized, it returns
HTTP `200` with all modes, English descriptions, HTTP methods, required query
parameters, JSON fields, and response types. The catalog comes directly
from the SDK and does not require a DV Live token or environment configuration.
Mapped SDK response data and the original DV Live HTTP status codes are returned without additional wrappers.

| mode | Method | Query parameters besides `mode` | JSON body | Response |
| --- | --- | --- | --- | --- |
| `getShowVoteChoice` | GET | `uuid` | — | Participant, status, images, rounds |
| `getShowVote` | GET | `uuid` | — | Show, dates, and current round with participants |
| `getVoter` | GET | `showVoteUuid`, `userRef` | — | Voter, balance, fraud status |
| `createVoter` | POST | `showVoteUuid` | Optional `email`, `phone`, `uniqRef` | Registration result |
| `castVote` | POST | `showVoteUuid`, `userRef` | Required `votes`, optional fraud prevention fields | Voting result and remaining votes, when provided |

`votes` is a non-empty array of `{ "choiceUuid": "...", "nbVotes": 1 }`.
The fraud prevention fields are `sessionToken`, `phoneFingerPrint`, `ip`, `userAgent`,
and `uniqSubscriptionId`. The SDK validates the body, field types, enums, and vote values before the HTTP request; other constraints are checked by the upstream API.
For POST requests, send `Content-Type: application/json`; query parameters do not belong in the body.

```sh
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=getShowVote&uuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN"

curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=castVote&showVoteUuid=SHOW_UUID&userRef=VOTER_REF' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"votes":[{"choiceUuid":"CHOICE_UUID","nbVotes":1}]}'
```

### Local environment and deployment

`supabase/.env` contains `DVLIVE_ENV`, set to `STAG` or `PROD`:

```dotenv
DVLIVE_ENV=STAG
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
supabase functions serve dvlive --env-file supabase/.env
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
return json(result.data, result.status);
```

The wrapper remains internal to the SDK: the public JSON is the mapped `result.data`.
The SDK decodes DV Live responses in `supabase/functions/_shared/sdk/src/responses/`, then converts them
into public model instances through their static `fromResponse()` factories in
`supabase/functions/_shared/sdk/src/models/`. Customize output fields and transformations in those factories;
the Edge Function receives and serializes the resulting model.
Current models keep existing field names and omit additional upstream properties.
Malformed response fields are rejected before DTO conversion.
The actual status code is preserved. HTTP errors retain their original status and payload, including text payloads;
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
`SUPABASE_ANON_KEY` in `script/config.json`, along with
`DVLIVE_BEARER_TOKEN`.
Locally, the default URL is `http://127.0.0.1:54321`; the key is resolved
as in `atom`: from the environment, then `supabase status -o json`, then the local demo key.
The DV Live token is sent through `bearer-token` and does not belong in the server's `.env` file.

Details, POST scripts, and available variables: [script/README.md](script/README.md).
SDK tests use mocked HTTP responses and run separately from the live smoke tests:

```sh
npm ci --prefix supabase/functions/_shared/sdk
npm --prefix supabase/functions/_shared/sdk test
```

Vote crediting is available only through `bash script/smoke-add-vote.sh`, which uses
local DV Live environment/bearer configuration and calls the upstream API directly with curl.
It is not exposed by the SDK, Edge Function, or reference runner.
