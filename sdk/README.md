# @digitalvirgo/dvlive-api

TypeScript SDK for the six DV Live voting endpoints. Uses standard `fetch` and
returns mapped data together with the original HTTP status and response headers.
No runtime dependencies, Deno globals, server configuration, or injected HTTP client.
Node.js >=18 or a compatible fetch runtime (including Supabase/Deno) is required.

## Usage

```ts
import { ApiService, GetShowVoteRequest, type ApiResponse, type ShowVote } from "@digitalvirgo/dvlive-api";

const api = new ApiService({
  environment: "STAG",
  headers: () => ({ Authorization: `Bearer ${token}` }),
  timeoutMs: 15_000,
});

const result: ApiResponse<ShowVote> = await api.getShowVote(new GetShowVoteRequest(showUuid));
console.log(result.data.name);
console.log(result.status);
console.log(result.headers.get("x-request-id"));
```

`headers` accepts a static record or a synchronous callback evaluated for every
request. The SDK provides `Accept: application/json` and, for JSON bodies,
`Content-Type: application/json`; supplied headers override these defaults.
`environment` is required and accepts exactly `"STAG"` or `"PROD"` (case-sensitive).
The SDK selects the base URL internally; callers do not configure a URL:

| Environment | Base URL |
| --- | --- |
| `STAG` | `https://dev-webshow-engine.dv-live.com` |
| `PROD` | `https://webshow-engine.dv-live.com` |

The URL mapping is maintained centrally in `src/environment.ts`.
Invalid or missing environments throw `TypeError`; there is no implicit fallback.
`ApiEnvironment` is internal and is not exported. `ApiServiceConfig.environment`
accepts `string | undefined`, allowing callers to pass an environment variable
directly; supported values and missing configuration are validated by the SDK.
Path parameters are encoded by the SDK, so pass their original values.
The default timeout is 15 seconds and also covers reading the response body.
Redirects are rejected and requests are never retried automatically.

## Methods and models

Every method returns `Promise<ApiResponse<T>>`:

```ts
class ApiResponse<T> {
  constructor(
    readonly data: T,
    readonly status: number,
    readonly headers: Headers,
  ) {}
}
```

| Method | Request type | Response data |
| --- | --- | --- |
| `getShowVote(request)` | `GetShowVoteRequest` | `ShowVote` |
| `getShowVoteChoice(request)` | `GetShowVoteChoiceRequest` | `ShowVoteChoice` |
| `getVoter(request)` | `GetVoterRequest` | `Voter` |
| `createVoter(request)` | `CreateVoterRequest` | `CreateVoterResult` |
| `addVote(request)` | `AddVoteRequest` | `AddVoteResult` |
| `castVote(request)` | `CastVoteRequest` | `CastVoteResult` |

`ApiResult` is the exported union of all six operation result models. Dispatchers
that support multiple modes can return `ApiResponse<ApiResult>`; individual SDK
methods retain their specific model return types.

Every method takes a validated request class instance. Constructors check typed
field constraints. GET request constructors take their path parameters; POST
request constructors additionally take a `CreateVoterBody`, `AddVoteBody`, or
`CastVoteBody` instance.

```ts
import {
  GetShowVoteRequest, GetShowVoteChoiceRequest, GetVoterRequest,
  CreateVoterRequest, AddVoteRequest, CastVoteRequest,
  CreateVoterBody, AddVoteBody, CastVoteBody,
} from "@digitalvirgo/dvlive-api";

await api.getShowVote(new GetShowVoteRequest(showUuid));
await api.getShowVoteChoice(new GetShowVoteChoiceRequest(choiceUuid));
await api.getVoter(new GetVoterRequest(showUuid, userRef));
await api.createVoter(new CreateVoterRequest(showUuid, new CreateVoterBody({ uniqRef: userRef })));
await api.addVote(new AddVoteRequest(showUuid, userRef,
  new AddVoteBody({ additionalVoteType: "VIDEO", nbPoints: 1 })));
await api.castVote(new CastVoteRequest(showUuid, userRef,
  CastVoteBody.decode({ votes: [{ choiceUuid, nbVotes: 1 }] })));
```

At the external JSON boundary, use a body's static `decode(value: unknown)`
method. It reads known fields explicitly and constructs validated instances:

```ts
const body = CastVoteBody.decode(await request.json());
const result = await api.castVote(new CastVoteRequest(showUuid, userRef, body));
```

Unknown JSON properties are ignored and are never forwarded upstream, including
extra fields inside individual votes. There is no generic key registry or
`Object.keys().filter()` validation. Raw `unknown` input is confined to decoding.
Only `request.body` is serialized into upstream POST JSON; path parameters remain
in the URL. Request and body instances are frozen, including vote entries and the
copied votes array, to preserve validated values. Services require the correct
request class and reject plain objects before accessing credentials or HTTP.

Public DTO classes, request classes, nested models, and enum unions are exported
from the package root. Request models live in `src/requests/`; DTOs live in
`src/models/`. Wire response classes in `src/responses/` are
internal to the service and are not exported from the package root.

The public DTOs are `ShowVote`, `ShowVoteChoice`, `Voter`, `CreateVoterResult`,
`AddVoteResult`, and `CastVoteResult`. Previous public `*Response` names have been
removed rather than retained as aliases. The mode catalog now reports DTO names.
Field names in the returned JSON are unchanged; additional upstream fields are omitted.

`body.votes`, `choiceUuid`, and `nbVotes` are required in vote requests.
`REFERAL` retains the upstream spelling. Successful vote and credit DTOs
include `nbVoteRemaining`.

### Response decoding and model construction

Each service method follows this flow:

```text
DV Live JSON → Response.decode() → Model.fromResponse() → ApiResponse<Model>
```

- `src/responses/` defines classes with upstream field names and static `decode()`
  methods that validate unknown JSON. Required fields, primitive types, integer
  values, enums, arrays, and nested objects follow the local OpenAPI contract.
  These methods do not coerce numeric strings, parse dates, or invent fallback values.
- `src/models/` defines public classes with constructors and static `fromResponse()`
  factories. Customize field names, computed values, and nested output structures
  inside these factories. Models refer to response types through `import type`,
  without a runtime dependency on response classes.
- `ApiService` receives unknown JSON from the HTTP transport, calls the response
  class's `decode()`, and constructs the model through `fromResponse()`. The transport
  accepts no decoder callbacks. There is no separate converters directory.

For example, the show service builds its result using:

```ts
const decoded = ShowVoteResponse.decode(response.data);
const data = ShowVote.fromResponse(decoded);
return new ApiResponse(data, response.status, response.headers);
```

To expose `title` instead of `name`, rename the `ShowVote` constructor property
in `src/models/show-vote.ts` and pass `response.name` to that constructor in
`ShowVote.fromResponse()`. Keep `ShowVoteResponse.name` and its decoding unchanged.
The model constructor can also be used directly with your own field values.
Model and envelope classes are exported as runtime values, so `new ShowVote(...)`,
`ShowVote.fromResponse(...)`, and `result.data instanceof ShowVote` are supported.

Nested round choices, participant rounds, and voter balances have their own
constructors and factories. They produce model instances independent of response
objects. Absent optional fields remain absent, explicit nulls remain null, and
only selected fields are returned. Factories build from validated response data;
runtime validation of raw JSON belongs to `Response.decode()`.

Invalid successful responses reject with `ApiResponseError`, retaining the
original body, status, and headers. Field decoding failures are available as
`error.cause`, including paths such as `ShowVoteResponse.round.choices[0].uuid`.
HTTP error responses bypass successful response decoding and keep their original
payload. The transport's raw body text stays internal.

The Edge Function serializes `result.data`, so changes to model fields and
`fromResponse()` also change its public JSON response. Properties are instance
data; static methods and class prototypes are not included in the serialized JSON.

Body constructors check string fields and nullable phone values, validate
acquisition types, and require positive integer points and vote counts. Vote
bodies require at least one valid vote. `CastVoteBody.decode()` constructs
`CastVoteChoiceRequest` instances internally. The class is also exported from the
package root for callers that construct vote bodies directly in TypeScript.
Path parameter constructors reject blank values and dot segments.
Invalid constructor arguments or JSON decoding throw `ApiValidationError`
synchronously, before credentials or HTTP calls. Service methods return promises
and reject invalid request instance types with the same error.
Optional fields remain optional; constraints such as lengths and phone formatting
remain with the upstream API.

HTTP status codes are preserved. The OpenAPI documents 200 for GET and 201 for
POST, but the SDK also preserves other successful statuses returned by the server.

## Mode enum, parsing and catalog

The SDK exports `ApiModes` (a string enum), `parseMode`, `getModeCatalog`, and
`API_MODES`. Query values remain `getShowVote`, `getShowVoteChoice`, `getVoter`,
`createVoter`, `addVote`, and `castVote`. Enum members use PascalCase, for example
`ApiModes.GetShowVote` and `ApiModes.CastVote`.

```ts
import { ApiModes, parseMode, GetShowVoteRequest } from "@digitalvirgo/dvlive-api";

const parsed = parseMode(url.searchParams.get("mode"));
if (parsed.mode === null) {
  return json(parsed.catalog); // Complete catalog, HTTP 200.
}

switch (parsed.mode) { // ApiModes, not an arbitrary string.
  case ApiModes.GetShowVote: {
    const result = await api.getShowVote(new GetShowVoteRequest(uuid));
    return json(result.data, result.status);
  }
  // Handle the remaining enum members.
}
```

`parseMode(value)` accepts a string, null or undefined and returns a discriminated
union: `{ mode: ApiModes, catalog: null }` or `{ mode: null, catalog: ModeCatalog }`.
Parsing is exact and case-sensitive; empty, missing and unsupported values return
the same catalog rather than throwing or silently choosing an operation.

The catalog contains `name`, an English description, and `modes`, keyed by enum
values. Every definition includes the HTTP method, English description, required
query parameters (`params`), supported JSON fields (`body`), required JSON fields
when applicable (`requiredBody`), and the response interface name (`response`).
`getModeCatalog()` returns this catalog directly; `API_MODES` is the typed registry
used by the Edge Function to select the HTTP method and expose the catalog. Mode metadata lives
only in the SDK.

The Edge Function returns the catalog with HTTP 200 for missing or unsupported
modes before reading a body, token or environment configuration, including on POST.
OPTIONS retains its usual CORS preflight response. Valid modes still enforce their
HTTP method, required parameters and authentication.

## Errors

```ts
import { ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError, GetVoterRequest } from "@digitalvirgo/dvlive-api";

try {
  await api.getVoter(new GetVoterRequest(showUuid, userRef));
} catch (error) {
  if (error instanceof ApiValidationError) {
    console.log(error.message); // Invalid request parameter or body; no HTTP request was sent.
  } else if (error instanceof ApiHttpError) {
    console.log(error.status, error.statusText);
    console.log(error.document); // Parsed JSON, when available; can be null.
    console.log(error.bodyText); // Original response text, including non-JSON.
    console.log(error.headers.get("retry-after"));
  } else if (error instanceof ApiRequestError) {
    console.log(error.kind); // "network" or "timeout"
  } else if (error instanceof ApiResponseError) {
    console.log(error.status, error.bodyText, error.cause); // Successful HTTP, invalid response contract.
  }
}
```

`ApiValidationError` represents invalid request parameters or bodies, including when the SDK is
used directly outside Supabase. `ApiHttpError` represents any non-2xx response, including empty and non-JSON error
bodies. `ApiResponseError` represents successful responses with missing, malformed,
non-object JSON, or fields that do not match the response contract. `ApiRequestError` includes the underlying failure as `cause`.
Invalid environment or timeout configuration throws `TypeError`.
No request or credential logging is performed by the SDK.

## Supabase integration

The Edge Function maps the package name to `sdk/src/index.ts` through its
`deno.json`, so local serving and deployment do not require npm publication or a
prebuilt `dist/`. Set the Supabase environment file to:

```dotenv
DVLIVE_ENV=STAG
```

The Edge Function passes `DVLIVE_ENV` directly as `environment` to the SDK along
with the caller's `bearer-token`. Only the SDK validates supported environment values. It does not
know the upstream base URLs. Missing or invalid configuration returns HTTP 500,
while the mode catalog remains available. The SDK does not read `.env` or cache
authentication.

The Edge Function handles HTTP method, query and header extraction, content type
and JSON parsing, then decodes the body using the SDK and constructs its request class. Its HTTP query parameters
and POST body format remain unchanged. Request parameter and body validation is owned by the SDK; the Edge Function
converts `ApiValidationError` to HTTP 400.

The Edge Function serializes the mapped `result.data` with `result.status`.
The SDK's response wrapper is not exposed in
the public JSON response. HTTP errors retain their upstream body and status;
network/decoding errors become 502, and timeouts become 504.

After publication, replace the local Deno import mapping with a pinned
`npm:@digitalvirgo/dvlive-api@VERSION` specifier. Publication is not performed by
the development or verification commands below.

## Development and packaging

From the repository root (Node.js >=22.18 for development tests):

```sh
npm ci --prefix sdk
npm --prefix sdk run check
npm --prefix sdk test
./script/test.sh
```

`check` checks source types, the public method contracts and the Edge Function.
`build` cleans `dist/` before compiling ESM and declarations so obsolete models
are not packaged. `test` builds the package, tests request and response validation,
model constructors and factories, nested model independence, and mocked HTTP calls, then checks the public
declarations as a consumer would use them.
`script/test.sh` runs these checks plus Edge Function tests and each Bash smoke
test with simulated upstream responses; no live votes or credits are created.

```sh
npm --prefix sdk run build
npm pack ./sdk --dry-run
```

The package exports only its root API. Published artifacts include `dist/` and
this README; source tests and Supabase credentials are excluded. A `prepack`
script builds the package before packaging. The npm scope must be configured
for the target registry before a separate publication step.
