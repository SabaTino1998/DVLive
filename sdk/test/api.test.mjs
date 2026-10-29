import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { ApiResponse, ShowVote, ShowVoteChoice, Voter, CreateVoterResult, AddVoteResult, CastVoteResult, ApiService, ApiValidationError, ApiHttpError, ApiRequestError, ApiResponseError } from "../dist/index.js";

const config = { environment: "STAG", headers: { Authorization: "Bearer test-token" } };
import { show, choice, voter, operation, cases, requestBodies } from "./responses.fixture.mjs";

for (const [method, args, path, payload] of cases) {
  test(`${method}: encoded path, typed data, HTTP status and headers`, async (t) => {
    const body = requestBodies[method];
    const status = body ? 201 : 200;
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url.href, `https://dev-webshow-engine.dv-live.com${path}`);
      assert.equal(options.method, body ? "POST" : "GET");
      assert.equal(options.headers.get("authorization"), "Bearer test-token");
      assert.equal(options.headers.get("accept"), "application/json");
      assert.equal(options.headers.get("content-type"), body ? "application/json" : null);
      if (body) assert.deepEqual(JSON.parse(options.body), body);
      else assert.equal(options.body, undefined);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(payload, { status, headers: { "X-Request-Id": "request-1", "Retry-After": "10" } });
    });
    const result = await new ApiService(config)[method](...args);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), payload);
    assert.ok(result instanceof ApiResponse);
    const Model = { getShowVote: ShowVote, getShowVoteChoice: ShowVoteChoice, getVoter: Voter,
      createVoter: CreateVoterResult, addVote: AddVoteResult, castVote: CastVoteResult }[method];
    assert.ok(result.data instanceof Model);
    assert.deepEqual(Object.keys(result).sort(), ["data", "headers", "status"]);
    assert.equal(result.status, status);
    assert.ok(result.headers instanceof Headers);
    assert.equal(result.headers.get("x-request-id"), "request-1");
    assert.equal(result.headers.get("retry-after"), "10");
    assert.equal(mock.mock.callCount(), 1);
  });
}

test("actual success status is preserved, including nonstandard upstream POST 200", async (t) => {
  for (const status of [200, 201]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(operation, { status }));
    assert.equal((await new ApiService(config).createVoter({ showVoteUuid: "show" })).status, status);
  }
});

test("HTTP failures preserve parsed document, raw text, statusText, headers and never retry", async (t) => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500]) {
    const document = status === 401 ? { authenticated: false } : { status: "error", code: status, message: "Failed", nbVoteRemaining: null };
    const bodyText = JSON.stringify(document);
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(bodyText, {
      status, statusText: "Upstream error", headers: { "Content-Type": "application/json", "Retry-After": "30" },
    }));
    await assert.rejects(new ApiService(config).getShowVote("show"), (err) => {
      assert.ok(err instanceof ApiHttpError);
      assert.equal(err.status, status);
      assert.equal(err.statusText, "Upstream error");
      assert.deepEqual(err.document, document);
      assert.equal(err.bodyText, bodyText);
      assert.equal(err.headers.get("retry-after"), "30");
      return true;
    });
    assert.equal(mock.mock.callCount(), 1);
  }
});

test("non-JSON and empty HTTP errors are HTTP errors, not decoding errors", async (t) => {
  for (const text of ["<html>Unavailable</html>", "", "null"]) {
    t.mock.method(globalThis, "fetch", async () => new Response(text, { status: 503, headers: { "Content-Type": "text/html" } }));
    await assert.rejects(new ApiService(config).getShowVote("show"), (err) => {
      assert.ok(err instanceof ApiHttpError);
      assert.equal(err.bodyText, text);
      assert.equal(err.document, text === "null" ? null : undefined);
      return true;
    });
  }
});

test("successful invalid, empty and non-object JSON responses are decoding errors", async (t) => {
  for (const text of ["", "{", "null", "[]", '"text"', "false"]) {
    t.mock.method(globalThis, "fetch", async () => new Response(text, { status: 200 }));
    await assert.rejects(new ApiService(config).getShowVote("show"), (err) => {
      assert.ok(err instanceof ApiResponseError);
      assert.equal(err.status, 200);
      assert.equal(err.bodyText, text);
      return true;
    });
  }
});

test("network errors while fetching or reading response bodies are classified", async (t) => {
  for (const bodyFailure of [false, true]) {
    const cause = new TypeError("Connection closed");
    const mock = t.mock.method(globalThis, "fetch", async () => {
      if (!bodyFailure) throw cause;
      return new Response(new ReadableStream({ start(controller) { controller.error(cause); } }));
    });
    await assert.rejects(new ApiService(config).getShowVote("show"), (err) => {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.kind, "network");
      assert.equal(err.cause, cause);
      return true;
    });
    assert.equal(mock.mock.callCount(), 1);
  }
});

test("configured timeout applies to fetch and body reading", async (t) => {
  for (const bodyFailure of [false, true]) {
    t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
      if (bodyFailure) {
        return new Response(new ReadableStream({
          async start(controller) {
            await delay(15);
            controller.error(signal.reason);
          },
        }));
      }
      await delay(15);
      throw signal.reason;
    });
    await assert.rejects(new ApiService({ ...config, timeoutMs: 1 }).getShowVote("show"), (err) => err instanceof ApiRequestError && err.kind === "timeout");
  }
});

test("dynamic headers refresh on each call and concurrent clients keep their own tokens", async (t) => {
  let token = "first";
  const seen = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    seen.push(options.headers.get("authorization"));
    await delay(1);
    return Response.json(show);
  });
  const api = new ApiService({ environment: config.environment, headers: () => ({ Authorization: token }) });
  await api.getShowVote("show");
  token = "second";
  await api.getShowVote("show");
  await Promise.all(["third", "fourth"].map((value) => new ApiService({ environment: config.environment, headers: { Authorization: value } }).getShowVote("show")));
  assert.deepEqual(seen, ["first", "second", "third", "fourth"]);
});

test("invalid environment, configuration and path parameters fail before making a request", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  for (const environment of ["", "stag", "prod", "DEV", "https://upstream.test", undefined, null, {}, "constructor", "__proto__"]) {
    assert.throws(() => new ApiService({ environment }), TypeError);
  }
  for (const timeoutMs of [0, -1, Infinity, 0.5]) assert.throws(() => new ApiService({ ...config, timeoutMs }), TypeError);
  for (const value of ["", " ", ".", "..", undefined, null, 123]) await assert.rejects(new ApiService(config).getShowVote(value), ApiValidationError);
  await assert.rejects(new ApiService(config).getVoter({ showVoteUuid: "show", userRef: undefined }), ApiValidationError);
  assert.equal(mock.mock.callCount(), 0);
});

test("STAG and PROD choose their SDK base URLs without external URL configuration", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url.href);
    return Response.json(show);
  });
  for (const environment of ["STAG", "PROD"]) {
    await new ApiService({ environment }).getShowVote("show");
  }
  // Production uses its configured SDK host.
  assert.deepEqual(urls, [
    "https://dev-webshow-engine.dv-live.com/show-vote/show",
    "https://webshow-engine.dv-live.com/show-vote/show",
  ]);
});

test("each endpoint maps only public response fields", async (t) => {
  for (const [method, args, , payload] of cases) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ ...payload, upstreamOnly: "private" }));
    const result = await new ApiService(config)[method](...args);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), payload);
    assert.ok(result instanceof ApiResponse);
    const Model = { getShowVote: ShowVote, getShowVoteChoice: ShowVoteChoice, getVoter: Voter,
      createVoter: CreateVoterResult, addVote: AddVoteResult, castVote: CastVoteResult }[method];
    assert.ok(result.data instanceof Model);
    assert.deepEqual(Object.keys(result).sort(), ["data", "headers", "status"]);
    assert.equal(Object.hasOwn(result.data, "upstreamOnly"), false);
  }
});

test("nested mappings preserve nulls and absent optional fields and omit upstream extras", async (t) => {
  const nestedChoice = { uuid: "choice", firstname: "First", lastname: "Last", bio: null };
  const round = { currentRound: 1, startDay: "2026-01-01", endDay: "2026-01-02", name: "Round", choices: [nestedChoice] };
  t.mock.method(globalThis, "fetch", async () => Response.json({
    ...show, round: { ...round, upstreamOnly: true, choices: [{ ...nestedChoice, upstreamOnly: true }] },
  }));
  assert.deepEqual(JSON.parse(JSON.stringify((await new ApiService(config).getShowVote("show")).data)), { ...show, round });

  for (const optional of [{}, { round: null }]) {
    const payload = { name: "Show", startDate: "2026-01-01", endDate: "2026-12-31", ...optional };
    t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    assert.deepEqual(JSON.parse(JSON.stringify((await new ApiService(config).getShowVote("show")).data)), payload);
  }

  const participant = { ...choice, eliminatedRound: { uuid: "round", round: 1 }, reintroducedRound: null };
  t.mock.method(globalThis, "fetch", async () => Response.json({
    ...participant, eliminatedRound: { ...participant.eliminatedRound, upstreamOnly: true },
  }));
  assert.deepEqual(JSON.parse(JSON.stringify((await new ApiService(config).getShowVoteChoice("choice")).data)), participant);

  const payload = { ...voter, email: null, phone: null, balance: { standardPoint: 0, additionalPoint: 2 } };
  t.mock.method(globalThis, "fetch", async () => Response.json({ ...payload, balance: { ...payload.balance, upstreamOnly: true } }));
  assert.deepEqual(JSON.parse(JSON.stringify((await new ApiService(config).getVoter({ showVoteUuid: "show", userRef: "voter" })).data)), payload);
});

test("unmappable nested responses retain HTTP context in ApiResponseError", async (t) => {
  const payload = { ...show, round: { choices: null } };
  t.mock.method(globalThis, "fetch", async () => Response.json(payload));
  await assert.rejects(new ApiService(config).getShowVote("show"), (error) => {
    assert.ok(error instanceof ApiResponseError);
    assert.equal(error.status, 200);
    assert.deepEqual(JSON.parse(error.bodyText), payload);
    return true;
  });
});
