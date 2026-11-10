import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiService, ApiHttpError, ApiRequestError, ApiResponseError } from "../dist/index.js";
import { DvLiveLogger } from "../dist/logger.js";
import { show, voter } from "./responses.fixture.mjs";

function capture(t) {
  const records = [];
  for (const method of ["info", "warn", "debug", "log", "error"]) {
    t.mock.method(console, method, (...args) => records.push({ method, args }));
  }
  return records;
}
const fail = () => Response.json({ message: "Denied" }, { status: 403 });

test("logging defaults to disabled and explicit FALSE stays silent, including errors", async (t) => {
  const records = capture(t);
  for (const settings of [{}, { logEnable: false }, { logEnable: "FALSE", logLevel: "DEBUG" }, { logLevel: "DEBUG" }]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(show));
    await new ApiService({ environment: "STAG", ...settings }).getShowVote("show");
    t.mock.method(globalThis, "fetch", fail);
    await assert.rejects(new ApiService({ environment: "STAG", ...settings }).getShowVote("show"), ApiHttpError);
  }
  assert.equal(records.length, 0);
});

test("TRUE without a level defaults to WARNING", async (t) => {
  const records = capture(t);
  const api = new ApiService({ environment: "STAG", logEnable: "TRUE" });
  t.mock.method(globalThis, "fetch", async () => Response.json(show));
  await api.getShowVote("show");
  assert.equal(records.length, 0);
  t.mock.method(globalThis, "fetch", fail);
  await assert.rejects(api.getShowVote("show"), ApiHttpError);
  assert.equal(records.length, 1);
  assert.equal(records[0].method, "warn");
  assert.equal(records[0].args[1].operation, "getShowVote");
  assert.equal(records[0].args[1].status, 403);
  assert.equal(typeof records[0].args[1].durationMs, "number");
});

test("INFO includes request/status/duration, WARNING, but no bodies or DEBUG", async (t) => {
  const records = capture(t);
  t.mock.method(globalThis, "fetch", fail);
  await assert.rejects(new ApiService({ environment: "STAG", logEnable: true, logLevel: "INFO" }).getShowVote("show"), ApiHttpError);
  assert.deepEqual(records.map(record => record.method), ["info", "info", "warn"]);
  assert.ok(records.every(record => !Object.hasOwn(record.args[1], "body")));
});

test("DEBUG includes sanitized request and response without mutating actual data", async (t) => {
  const records = capture(t);
  const reference = "N_sensitive/with|characters";
  const payload = { ...voter, uniqRef: reference, email: "private@example.test", phone: "+3912345678" };
  const upstream = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer private-bearer");
    return Response.json(payload);
  });
  const api = new ApiService({ environment: "STAG", logEnable: "TRUE", logLevel: "DEBUG", headers: { Authorization: "Bearer private-bearer" } });
  const result = await api.getVoter({ showVoteUuid: "show", userRef: reference });
  assert.equal(upstream.mock.calls[0].arguments[0].pathname, `/show-vote/show/voter/${encodeURIComponent(reference)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), payload);
  const serialized = JSON.stringify(records);
  for (const value of [reference, encodeURIComponent(reference), "private-bearer", payload.email, payload.phone]) assert.equal(serialized.includes(value), false, value);
  assert.ok(records.some(record => record.method === "debug"));
  assert.ok(serialized.includes("REDACTED"));
  assert.ok(serialized.includes("remainingPoints"));
});

test("DEBUG sanitizes POST body and credentials echoed in upstream messages", async (t) => {
  const records = capture(t);
  const body = { uniqRef: "plain-reference", email: "person@example.test", phone: "+3912345678" };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), body);
    return Response.json({ message: "Rejected private-bearer N_ref|secret", email: body.email, phone: body.phone }, { status: 400 });
  });
  await assert.rejects(new ApiService({ environment: "STAG", logEnable: true, logLevel: "DEBUG", headers: { Authorization: "Bearer private-bearer" } }).createVoter({ showVoteUuid: "show", ...body }), ApiHttpError);
  const serialized = JSON.stringify(records);
  for (const value of [...Object.values(body), "private-bearer", "N_ref|secret"]) assert.equal(serialized.includes(value), false, value);
});

test("WARNING reports network, timeout, malformed JSON and contract decoding failures", async (t) => {
  const records = capture(t);
  const api = new ApiService({ environment: "STAG", logEnable: true });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("private network error"); });
  await assert.rejects(api.getShowVote("show"), ApiRequestError);
  t.mock.method(globalThis, "fetch", async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); });
  await assert.rejects(api.getShowVote("show"), error => error instanceof ApiRequestError && error.kind === "timeout");
  t.mock.method(globalThis, "fetch", async () => new Response("private invalid JSON"));
  await assert.rejects(api.getShowVote("show"), ApiResponseError);
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(api.getShowVote("show"), ApiResponseError);
  assert.equal(records.length, 4);
  assert.ok(records.every(record => record.method === "warn"));
  assert.equal(JSON.stringify(records).includes("private"), false);
});

test("log configuration is per client, accepts env strings, and validates enabled levels", async (t) => {
  const records = capture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json(show));
  const enabled = new ApiService({ environment: "STAG", logEnable: " true ", logLevel: " debug " });
  const disabled = new ApiService({ environment: "STAG" });
  await Promise.all([enabled.getShowVote("enabled-show"), disabled.getShowVote("disabled-show")]);
  assert.equal(JSON.stringify(records).includes("disabled-show"), false);
  assert.ok(JSON.stringify(records).includes("enabled-show"));
  assert.throws(() => new ApiService({ environment: "STAG", logEnable: "YES" }), /logEnable/);
  assert.throws(() => new ApiService({ environment: "STAG", logEnable: true, logLevel: "TRACE" }), /logLevel/);
  assert.doesNotThrow(() => new ApiService({ environment: "STAG", logEnable: false, logLevel: "unused" }));
});

test("logger never changes API outcomes if the console fails", async (t) => {
  for (const method of ["info", "warn", "debug"]) t.mock.method(console, method, () => { throw new Error("broken console"); });
  t.mock.method(globalThis, "fetch", async () => Response.json(show));
  assert.equal((await new ApiService({ environment: "STAG", logEnable: true, logLevel: "DEBUG" }).getShowVote("show")).data.name, show.name);
  const logger = new DvLiveLogger(true, "WARNING");
  assert.doesNotThrow(() => logger.write("WARNING", "test", {}));
});
