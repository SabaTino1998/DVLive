import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { ApiService, ApiValidationError, ApiHttpError, ApiRequestError, ApiResponseError } from "../dist/index.js";

const config = { environment: "STAG", headers: { Authorization: "Bearer test-token" } };
const show = { name: "Show", startDate: "2026-01-01", endDate: "2026-12-31", round: null };
const choice = { uuid: "choice", showVoteUuid: "show", firstname: "First", lastname: "Last", status: "ACTIVE", order: 1, bio: null };
const voter = { uniqRef: "a/b", remainingPoints: 3, userFraudStatus: "CLEAN", balance: { standardPoint: 3 } };
const operation = { status: "success", code: 201, message: "Recorded" };
const cases = [
  ["getShowVote", ["a/b"], "/show-vote/a%2Fb", show],
  ["getShowVoteChoice", ["choice"], "/show-vote-choice/choice", choice],
  ["getVoter", ["show", "a/b ?#"], "/show-vote/show/voter/a%2Fb%20%3F%23", voter],
  ["createVoter", ["show", { uniqRef: "a/b", phone: null }], "/show-vote/show/voter", operation],
  ["addVote", ["show", "a/b", { nbPoints: 3, additionalVoteType: "VIDEO" }], "/show-vote/show/voter/a%2Fb/add-vote", { ...operation, nbVoteRemaining: 3 }],
  ["castVote", ["show", "a/b", { votes: [{ choiceUuid: "choice", nbVotes: 1 }], sessionToken: "session" }], "/show-vote/show/voter/a%2Fb/vote", { ...operation, nbVoteRemaining: 2 }],
];

for (const [method, args, path, payload] of cases) {
  test(`${method}: encoded path, typed data, HTTP status and headers`, async (t) => {
    const body = typeof args.at(-1) === "object" ? args.at(-1) : undefined;
    const status = body ? 201 : 200;
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url.href, `https://dev-webshow-engine.dv-live.com${path}`);
      assert.equal(options.method, body ? "POST" : "GET");
      assert.equal(options.headers.get("authorization"), "Bearer test-token");
      assert.equal(options.headers.get("accept"), "application/json");
      assert.equal(options.headers.get("content-type"), body ? "application/json" : null);
      assert.equal(options.body, body ? JSON.stringify(body) : undefined);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(payload, { status, headers: { "X-Request-Id": "request-1", "Retry-After": "10" } });
    });
    const result = await new ApiService(config)[method](...args);
    assert.deepEqual(result.data, payload);
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
    assert.equal((await new ApiService(config).createVoter("show", {})).status, status);
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

test("invalid environment, configuration and path parameters fail before making a request", (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  for (const environment of ["", "stag", "prod", "DEV", "https://upstream.test", undefined, null, {}, "constructor", "__proto__"]) {
    assert.throws(() => new ApiService({ environment }), TypeError);
  }
  for (const timeoutMs of [0, -1, Infinity, 0.5]) assert.throws(() => new ApiService({ ...config, timeoutMs }), TypeError);
  for (const value of ["", " ", ".", "..", undefined, null, 123]) assert.throws(() => new ApiService(config).getShowVote(value), ApiValidationError);
  assert.throws(() => new ApiService(config).getVoter("show", undefined), ApiValidationError);
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
