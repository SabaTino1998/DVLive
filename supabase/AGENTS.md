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

## Constructing SDK requests

Services accept validated request class instances, not plain object literals.
Use constructors for path parameters and a body's public static `decode()` for
untrusted JSON:

```ts
api.getShowVote(new GetShowVoteRequest(uuid));
api.getShowVoteChoice(new GetShowVoteChoiceRequest(uuid));
api.getVoter(new GetVoterRequest(showVoteUuid, userRef));
api.createVoter(new CreateVoterRequest(showVoteUuid, CreateVoterBody.decode(body)));
api.addVote(new AddVoteRequest(showVoteUuid, userRef, AddVoteBody.decode(body)));
api.castVote(new CastVoteRequest(showVoteUuid, userRef, CastVoteBody.decode(body)));
```

Keep incoming JSON typed as `unknown` until the appropriate SDK decoder accepts
it. Do not cast it to a body type or duplicate its validation in the function.
Constructors and decoders throw `ApiValidationError` synchronously; keep request
construction inside the handler's error boundary.

Body decoders select known fields explicitly and ignore extra JSON properties,
including extra fields in individual votes. Do not reintroduce generic
`Object.keys().filter()` rejection of unknown body fields. Internal decoding
helpers belong to the SDK and must not be imported by the function.

Request and body instances are frozen. Construct a new instance to change their
values. `CastVoteBody.decode()` creates its vote entries internally; the Edge
Function does not need to import `CastVoteChoiceRequest`. That class remains a
public SDK export for other consumers that construct vote bodies directly.

## Results, models, and errors

Keep `callApi` typed as `Promise<ApiResponse<ApiResult>>`. `ApiResult` is the SDK
union of the six possible operation models. Individual SDK methods keep their
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

Keep `createHandler({ env })` injectable so tests can provide environment values.
For integration or SDK behavior changes, run:

```sh
./script/test.sh
```

The repository harness currently includes SDK development checks and simulated
upstream tests for the function and smoke scripts. When migrating the runtime
mapping to npm, adapt any harness resolution that assumes a local SDK checkout
to exercise the same pinned package used by the function. SDK development checks
can remain a separate workflow; do not restore a fixed source path to make npm
integration tests pass. Verify function types, public package imports, registry
resolution, and local bundling after dependency configuration changes.

When extending an operation, implement SDK changes in its own repository:
request/body, response decoder, model factory, mode metadata, `ApiResult` union,
and public exports as applicable. Publish the required SDK version, update the
function's pinned dependency, and update function dispatch and affected tests. Cover invalid input before
upstream calls, extra fields, response decoding failures, error/status
preservation, and concurrent request token isolation where relevant. Keep local
verification deterministic: simulated upstream tests must not create real votes
or credits.
