# DVLive SDK and Edge Function integration

These instructions apply to `supabase/` and its descendants. Keep the Edge
Function as an HTTP adapter around the SDK. Read [the project README](../README.md)
and the documentation for the selected npm package version before changing the integration.

## Files and responsibilities

- `functions/dvlive/index.ts`: HTTP input parsing, authentication header
  extraction, SDK dispatch, CORS, and conversion of SDK results/errors to HTTP.
- `functions/dvlive/deno.json`: version-pinned npm SDK mapping and strict TypeScript settings.
- `functions/dvlive/.npmrc`: Digital Virgo npm scope registry configuration and,
  when needed, registry authentication through environment variable references.
- `config.toml`: function entrypoint and Supabase gateway configuration.
- `.env.example`: template for the local function environment.
- The SDK package root: the supported public exports. Import from
  `@digitalvirgo/dvlive-api`, not from internal package modules.

The SDK owns upstream URLs, supported environments, request validation, response
decoding, public model construction, HTTP transport, and timeouts. Keep that
logic reusable across projects rather than implementing it in the Edge Function.

## SDK dependency

The target integration consumes the published npm package, independently of
where its source repository is checked out. Import the SDK as
`@digitalvirgo/dvlive-api` and map that name in `functions/dvlive/deno.json` to a
verified, published, pinned `npm:@digitalvirgo/dvlive-api@<published-version>`.
Replace the version placeholder with an actual published version. A version in
a local SDK `package.json` does not establish npm availability.

Keep a `.npmrc` alongside the function entrypoint at
`functions/dvlive/.npmrc`. Configure the `@digitalvirgo` scope to use the
organization's actual package registry. If that registry requires authentication,
reference credentials through environment variables rather than putting token
values in the file. Make registry credentials available to the processes that
resolve dependencies during local serving and deployment; these credentials are
separate from the caller's DV Live bearer token and Supabase authentication.

Do not use an absolute filesystem path, a relative path into an SDK source
checkout, a symlink, or a local `dist/` directory as the npm integration's
dependency. Application imports must stay unchanged when updating the package
version. Verify registry resolution and function bundling with the pinned
version and the function's `.npmrc` configuration.

## Environment and authentication

Pass the environment value directly to the SDK:

```ts
const api = new ApiService({
  environment: env("DVLIVE_ENV"),
  logEnable: env("DVLIVE_LOG_ENABLE"),
  logLevel: env("DVLIVE_LOG_LEVEL"),
  headers: () => ({ Authorization: `Bearer ${token}` }),
});
```

The SDK validates supported values and selects the upstream URL. Do not import
or expose `ApiEnvironment`, duplicate environment checks, or define upstream
URLs in the function. Invalid SDK configuration returns HTTP 500.

Read the DV Live token from the caller's `bearer-token` header, without a
`Bearer` prefix. Trim it and return HTTP 401 if it is absent or blank. Supply it
to the SDK as upstream `Authorization: Bearer <token>`. Keep token state local
to the request; concurrent requests must not share credentials. Do not store the
DV Live token in the server environment or log it.

Supabase gateway authentication is separate from DV Live authentication.
`verify_jwt` is currently `false` in `config.toml`; do not use the caller's
Supabase `Authorization` header as the DV Live token.

## SDK logging

The SDK owns logging. The Edge Function only reads the environment values and
passes them to `ApiService` as shown above. Do not add another logger, duplicate
level parsing, or read logging settings from caller headers or query parameters.
Keep configuration and credentials local to each request.

Configure logging in `supabase/.env`, loaded with `--env-file supabase/.env`:

```dotenv
DVLIVE_LOG_ENABLE=TRUE
DVLIVE_LOG_LEVEL=DEBUG
```

| Environment variable | SDK option | Values | Default when absent |
| --- | --- | --- | --- |
| `DVLIVE_LOG_ENABLE` | `logEnable` | `TRUE`, `FALSE` | `FALSE` |
| `DVLIVE_LOG_LEVEL` | `logLevel` | `WARNING`, `INFO`, `DEBUG` | `WARNING` |

Without `DVLIVE_LOG_ENABLE=TRUE`, no SDK logs are emitted, even if a level is
configured. The level is ignored while logging is disabled. The SDK trims and
normalizes string values case-insensitively. Invalid enable values or invalid
levels when enabled are SDK configuration errors: preserve the existing HTTP
500 configuration response. Keep logging disabled in `.env.example` by default
and preserve existing local settings when updating environment files.

- `WARNING`: upstream HTTP failures, network failures, timeouts, invalid JSON,
  and response decoding failures.
- `INFO`: includes WARNING and adds request start, operation, method, sanitized
  URL, response status, and duration in milliseconds.
- `DEBUG`: includes INFO and adds sanitized request and parsed response bodies.

Logs use `[DVLive][LEVEL]` prefixes through `console.warn`, `console.info`, and
`console.debug`. Locally they appear in the terminal running
`supabase functions serve`; after deployment they appear in the function logs
in the Supabase dashboard. They are not included in HTTP responses or emitted
in the Expo browser console. SmartUser client debug settings are independent.
Restart local function serving after changing `.env`; update the deployed
function environment for remote logging configuration.

The SDK omits authentication headers and redacts user references, tokens,
contact details, names, and other sensitive fields. Do not bypass that
sanitization by logging raw requests, responses, headers, or error causes in
the adapter. Logging must not change API results or error handling. Input
rejected before an SDK HTTP request is outside the transport log.

Missing or unsupported modes must still return the catalog before reading
logging configuration or constructing `ApiService`. Verify disabled defaults,
WARNING as the default enabled level, level filtering, credential redaction,
and environment forwarding with mocked SDK/adapter tests. See
[SDK logging](../sdk/README.md#logging) for the public configuration contract.

## Modes and HTTP input

Use `parseMode`, `ApiModes`, and `API_MODES` from the SDK. The enum is named
`ApiModes`, and its source file is `ApiModes.ts`. Do not maintain another mode
catalog or duplicate its required-field definitions in the function.

After handling OPTIONS, parse `mode` first. A missing, empty, or unrecognized
mode returns the SDK catalog with HTTP 200 before reading the body, requiring a
DV Live token, or constructing `ApiService`. This also applies to POST requests.

For a recognized mode, check the HTTP method against the SDK definition. Return
405 with an `Allow` header on mismatch. POST requests require
`Content-Type: application/json` (optional parameters such as charset are allowed):
return 415 for an unsupported content type and 400 for malformed JSON.

Read URL values into explicit variables such as `uuid`, `showVoteUuid`, and
`userRef`. Keep path parameters in the query of the public Edge endpoint; do not
merge them into the upstream JSON body or create a generic parameter map.

## Calling the SDK

Use the public service methods with simple parameters. Request and body classes,
wire responses, and decoders are internal SDK details and are not root exports.
The SDK constructs and validates its requests internally.

```ts
api.getShowVote(uuid);
api.getShowVoteChoice(uuid);
api.getVoter({ showVoteUuid, userRef });
api.createVoter({ showVoteUuid }, body);
api.castVote({ showVoteUuid, userRef }, body);
```

For HTTP POST input, keep parsed JSON typed as `unknown` and pass it as the
second argument. These overloads validate raw data inside the SDK; do not cast
it to a typed input, spread it into route values, or duplicate body validation
in the function. Keep the service call inside the handler's error boundary and
await it; invalid input rejects with `ApiValidationError`.

Other TypeScript consumers can pass one flat typed input instead, for example
`api.castVote({ showVoteUuid, userRef, votes: [{ choiceUuid, nbVotes: 1 }] })`.
Input interfaces and field types are public type-only exports. Models, errors,
mode parsing, and catalog utilities remain in the same package entrypoint;
do not add a separate `/edge` entrypoint.

The SDK selects known body fields explicitly and ignores extra JSON properties,
including extra fields in individual votes. Route values passed separately
cannot be overridden by body properties. Do not reintroduce generic key-registry
validation in the function. SDK requests are frozen internally; caller inputs
are copied as needed and are not mutated.

## Results, models, and errors

Keep `callApi` typed as `Promise<ApiResponse<ApiResult>>`. `ApiResult` is the SDK
union of the five possible operation models. Individual SDK methods keep their
specific model types; do not introduce an unconstrained caller-selected generic.

The SDK follows `Response.decode()` -> `Model.fromResponse()` -> `ApiResponse`.
Response classes validate upstream JSON. Public model classes own field naming
and transformations through constructors and static `fromResponse()` factories.
There is no separate converters directory. `ApiResponse` only wraps `data`,
`status`, and `headers`; it has no `fromResponse()` method.

Return `json(result.data, result.status)`. Preserve the actual upstream success
status, including a POST that returns 200 instead of 201. Do not expose the SDK
wrapper or raw transport body text in successful public JSON. Change public data
fields in SDK models, not through transformations in the Edge Function.

Import error classes from the package root; their SDK source is `ApiErrors.ts`.

| Error | Edge response |
| --- | --- |
| `ApiValidationError` | HTTP 400 with the SDK validation message |
| SDK constructor/configuration error | HTTP 500 |
| `ApiHttpError` | Original upstream status and JSON payload, or original text body and content type |
| `ApiRequestError` with `kind === "network"` | HTTP 502 |
| `ApiRequestError` with `kind === "timeout"` | HTTP 504 |
| `ApiResponseError` | HTTP 502 |
| Unexpected error | HTTP 500 with the existing generic message |

Keep CORS headers on success and error responses. OPTIONS returns 204 and allows
GET, POST, OPTIONS, and the existing request headers, including `bearer-token`.
Do not forward upstream headers wholesale. `Retry-After` forwarding, CORS
exposure, and automatic retries are not part of this integration.

## Local setup and verification

Run commands from the repository root. For a fresh checkout, configure the
function's `.npmrc`, provide any required registry credentials, and select a
published SDK version in its Deno import map. Copy `supabase/.env.example` to
`supabase/.env` if the local file does not already exist. Preserve existing local
environment values. An SDK source checkout and SDK build are not prerequisites
for consuming the npm package. With Supabase CLI and Docker available:

```sh
supabase start
supabase functions serve dvlive --env-file supabase/.env
```

Verify integration behavior by running the relevant smoke script separately
for each operation against an active local or remote function. Configure the
shared URL and credentials and each script's identifiers as described in
[the smoke test guide](../script/README.md). There is no combined integration
runner. POST smoke scripts create or modify real data; use test resources.

SDK type checks and unit tests remain a separate workflow in its own repository,
using mocked HTTP responses. Verify function types, public package imports,
registry resolution, and local bundling after dependency configuration changes.
Do not introduce a fixed SDK source path for npm integration checks.

When extending an operation, implement SDK changes in its own repository:
request/body, response decoder, model factory, mode metadata, `ApiResult` union,
and public exports as applicable. Publish the required SDK version, update the
function's pinned dependency, and update function dispatch and affected tests. Cover invalid input before
upstream calls, extra fields, response decoding failures, error/status
preservation, and concurrent request token isolation where relevant. Keep SDK
unit tests deterministic with mocked HTTP; run live smoke checks per operation.
