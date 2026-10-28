# @digitalvirgo/dvlive-api

TypeScript SDK for the six DV Live voting endpoints. Uses standard `fetch` and
returns decoded data together with the original HTTP status and response headers.
No runtime dependencies, Deno globals, server configuration, or injected HTTP client.
Node.js >=18 or a compatible fetch runtime (including Supabase/Deno) is required.

## Usage

```ts
import { ApiService, type ApiResponse, type ShowVoteResponse } from "@digitalvirgo/dvlive-api";

const api = new ApiService({
  environment: "STAG",
  headers: () => ({ Authorization: `Bearer ${token}` }),
  timeoutMs: 15_000,
});

const result: ApiResponse<ShowVoteResponse> = await api.getShowVote(showUuid);
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
`ApiEnvironment` is exported for typed configuration.
Path parameters are encoded by the SDK, so pass their original values.
The default timeout is 15 seconds and also covers reading the response body.
Redirects are rejected and requests are never retried automatically.

## Methods and models

Every method returns `Promise<ApiResponse<T>>`:

```ts
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}
```

| Method | Request body | Response data |
| --- | --- | --- |
| `getShowVote(uuid)` | — | `ShowVoteResponse` |
| `getShowVoteChoice(uuid)` | — | `ShowVoteChoiceResponse` |
| `getVoter(showVoteUuid, userRef)` | — | `GetVoterResponse` |
| `createVoter(showVoteUuid, body)` | `CreateVoterRequest` | `CreateVoterResponse` |
| `addVote(showVoteUuid, userRef, body)` | `AddVoteRequest` | `AddVoteResponse` |
| `castVote(showVoteUuid, userRef, body)` | `CastVoteRequest` | `CastVoteResponse` |

All request and response interfaces, nested models and enum unions are exported
from the package root. They follow the DV Live API specification, including optional
and nullable fields. `votes`, `choiceUuid`, and `nbVotes` are required in vote requests
to reflect the documented voting operation. `REFERAL` retains the upstream spelling.
Successful vote and credit responses include `nbVoteRemaining`.

Response interfaces define the SDK's public data contract. Successful responses
are decoded as JSON objects, preserving additional upstream properties. The SDK
does not perform full runtime schema validation of response fields.

Before POST requests, the SDK validates that the body is an object, rejects unknown
fields using the mode catalog, checks string fields and nullable phone values,
validates acquisition types, and requires positive integer points and vote counts.
Casting votes also requires a non-empty votes array and non-blank choice UUIDs.
Invalid bodies throw `ApiValidationError` before header callbacks or HTTP calls.
Optional fields remain optional as described by the request interfaces; additional
server-side constraints such as field lengths and phone formatting remain with the API.

HTTP status codes are preserved. The OpenAPI documents 200 for GET and 201 for
POST, but the SDK also preserves other successful statuses returned by the server.

## Mode enum, parsing and catalog

The SDK exports `ApiMode` (a string enum), `parseMode`, `getModeCatalog`, and
`API_MODES`. Query values remain `getShowVote`, `getShowVoteChoice`, `getVoter`,
`createVoter`, `addVote`, and `castVote`. Enum members use PascalCase, for example
`ApiMode.GetShowVote` and `ApiMode.CastVote`.

```ts
import { ApiMode, parseMode } from "@digitalvirgo/dvlive-api";

const parsed = parseMode(url.searchParams.get("mode"));
if (parsed.mode === null) {
  return json(parsed.catalog); // Complete catalog, HTTP 200.
}

switch (parsed.mode) { // ApiMode, not an arbitrary string.
  case ApiMode.GetShowVote: {
    const result = await api.getShowVote(uuid);
    return json(result.data, result.status);
  }
  // Handle the remaining enum members.
}
```

`parseMode(value)` accepts a string, null or undefined and returns a discriminated
union: `{ mode: ApiMode, catalog: null }` or `{ mode: null, catalog: ModeCatalog }`.
Parsing is exact and case-sensitive; empty, missing and unsupported values return
the same catalog rather than throwing or silently choosing an operation.

The catalog contains `name`, an English description, and `modes`, keyed by enum
values. Every definition includes the HTTP method, English description, required
query parameters (`params`), supported JSON fields (`body`), required JSON fields
when applicable (`requiredBody`), and the response interface name (`response`).
`getModeCatalog()` returns this catalog directly; `API_MODES` is the typed registry
used by the Edge Function to validate required parameters. Mode metadata lives
only in the SDK.

The Edge Function returns the catalog with HTTP 200 for missing or unsupported
modes before reading a body, token or environment configuration, including on POST.
OPTIONS retains its usual CORS preflight response. Valid modes still enforce their
HTTP method, required parameters and authentication.

## Errors

```ts
import { ApiHttpError, ApiRequestError, ApiResponseError, ApiValidationError } from "@digitalvirgo/dvlive-api";

try {
  await api.getVoter(showUuid, userRef);
} catch (error) {
  if (error instanceof ApiValidationError) {
    console.log(error.message); // Invalid request body; no HTTP request was sent.
  } else if (error instanceof ApiHttpError) {
    console.log(error.status, error.statusText);
    console.log(error.document); // Parsed JSON, when available; can be null.
    console.log(error.bodyText); // Original response text, including non-JSON.
    console.log(error.headers.get("retry-after"));
  } else if (error instanceof ApiRequestError) {
    console.log(error.kind); // "network" or "timeout"
  } else if (error instanceof ApiResponseError) {
    console.log(error.status, error.bodyText); // Successful HTTP, invalid response body.
  }
}
```

`ApiValidationError` represents invalid request bodies, including when the SDK is
used directly outside Supabase. `ApiHttpError` represents any non-2xx response, including empty and non-JSON error
bodies. `ApiResponseError` represents successful responses with missing, malformed,
or non-object JSON. `ApiRequestError` includes the underlying failure as `cause`.
Invalid environment, timeout configuration or path parameters throw `TypeError`.
No request or credential logging is performed by the SDK.

## Supabase integration

The Edge Function maps the package name to `sdk/src/index.ts` through its
`deno.json`, so local serving and deployment do not require npm publication or a
prebuilt `dist/`. Set the Supabase environment file to:

```dotenv
DVLIVE_ENV=STAG
```

The Edge Function reads `DVLIVE_ENV`, checks that it is `STAG` or `PROD`, and passes
it as `environment` to the SDK along with the caller's `bearer-token`. It does not
know the upstream base URLs. Missing or invalid configuration returns HTTP 500,
while the mode catalog remains available. The SDK does not read `.env` or cache
authentication.

The Edge Function handles HTTP method, query and header extraction, content type
and JSON parsing. Request body validation is owned by the SDK; the Edge Function
converts `ApiValidationError` to HTTP 400.

The Edge Function serializes `result.data` with `result.status`. It forwards only
`Retry-After` from upstream headers. The SDK's response wrapper is not exposed in
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
`test` builds ESM and declarations, runs tests using mocked `fetch`, and checks
the built package's public declarations as a consumer would use them.
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
