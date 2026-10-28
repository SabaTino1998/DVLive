#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix sdk run check
npm --prefix sdk test
node --input-type=module - <<'NODE'
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

// Resolve the same SDK alias as Deno, without installing an unpublished npm package.
const denoConfigUrl = new URL("./supabase/functions/dvlive/deno.json", import.meta.url);
const importMap = JSON.parse(await readFile(denoConfigUrl, "utf8")).imports;
const sdkSourceUrl = new URL(importMap["@digitalvirgo/dvlive-api"], denoConfigUrl);
// Use the built SDK in Node: TypeScript enums require compilation, unlike Deno.
const sdkUrl = new URL("../dist/index.js", sdkSourceUrl).href;
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "@digitalvirgo/dvlive-api" ? sdkUrl : specifier, context);
} });
const { createHandler } = await import("./supabase/functions/dvlive/index.ts");

const env = (key) => ({ DVLIVE_ENV: "STAG" })[key];
const request = (query = "", options = {}) => new Request(`http://localhost/functions/v1/dvlive${query}`, { ...options, headers: { Authorization: "Bearer supabase-jwt", "bearer-token": "upstream-secret", ...options.headers } });

test("all six modes forward method, encoded paths, body, auth and upstream status", async (t) => {
  const cases = [
    ["getShowVoteChoice", "uuid=a%2Fb", "/show-vote-choice/a%2Fb"],
    ["getShowVote", "uuid=show", "/show-vote/show"],
    ["getVoter", "showVoteUuid=show&userRef=a%2Fb", "/show-vote/show/voter/a%2Fb"],
    ["createVoter", "showVoteUuid=show", "/show-vote/show/voter", { uniqRef: "test" }],
    ["addVote", "showVoteUuid=show&userRef=test", "/show-vote/show/voter/test/add-vote", { nbPoints: 1, additionalVoteType: "VIDEO" }],
    ["castVote", "showVoteUuid=show&userRef=test", "/show-vote/show/voter/test/vote", { votes: [{ choiceUuid: "choice", nbVotes: 1 }] }],
  ];
  for (const [mode, query, path, body] of cases) {
    let called = false;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      called = true;
      assert.equal(url.href, `https://dev-webshow-engine.dv-live.com${path}`);
      assert.equal(options.method, body ? "POST" : "GET");
      assert.equal(options.headers.get("authorization"), "Bearer upstream-secret");
      assert.equal(options.body, body ? JSON.stringify(body) : undefined);
      assert.equal(options.redirect, "error");
      return Response.json({ status: "success" }, { status: mode === "createVoter" ? 201 : 200 });
    });
    const handler = createHandler({ env });
    const response = await handler(request(`?mode=${mode}&${query}`, body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer supabase-jwt" }, body: JSON.stringify(body) } : undefined));
    assert.equal(response.status, mode === "createVoter" ? 201 : 200);
    assert.ok(called, mode);
    assert.deepEqual(await response.json(), { status: "success" });
  }
});

test("upstream failures preserve status and payload", async (t) => {
  for (const status of [401, 403, 404, 409, 422, 429, 500]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ code: status, message: "error" }, { status, headers: { "Retry-After": "30" } }));
    const handler = createHandler({ env });
    const response = await handler(request("?mode=getShowVote&uuid=test"));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("retry-after"), null);
    assert.deepEqual(await response.json(), { code: status, message: "error" });
  }
});

test("DVLIVE_ENV selects the SDK environment and rejects invalid values before HTTP calls", async (t) => {
  const urls = [];
  const upstream = t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url.href);
    return Response.json({ name: "Show" });
  });
  for (const environment of ["STAG", "PROD"]) {
    const handler = createHandler({ env: (key) => key === "DVLIVE_ENV" ? environment : undefined });
    assert.equal((await handler(request("?mode=getShowVote&uuid=show"))).status, 200);
  }
  assert.deepEqual(urls, ["https://dev-webshow-engine.dv-live.com/show-vote/show", "https://webshow-engine.dv-live.com/show-vote/show"]);
  const count = upstream.mock.callCount();
  for (const environment of [undefined, "", "DEV", "prod"]) {
    const handler = createHandler({ env: () => environment });
    assert.equal((await handler(request("?mode=getShowVote&uuid=show"))).status, 500);
    assert.equal((await handler(request())).status, 200);
  }
  assert.equal(upstream.mock.callCount(), count);
});

test("missing or unparseable modes return the SDK catalog without authentication or upstream calls", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
  const { getModeCatalog } = await import(sdkUrl);
  const handler = createHandler({ env: () => undefined });
  for (const query of ["", "?mode=", "?mode=unknown", "?mode=constructor", "?mode=__proto__", "?mode=toString", "?mode=GETSHOWVOTE"]) {
    for (const method of ["GET", "POST"]) {
      const response = await handler(new Request(`http://localhost/functions/v1/dvlive${query}`, {
        method, ...(method === "POST" ? { body: "invalid JSON" } : {}),
      }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.deepEqual(await response.json(), getModeCatalog());
    }
  }
  assert.equal(upstream.mock.callCount(), 0);
  const preflight = await handler(new Request("http://localhost/functions/v1/dvlive", { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
});

test("SDK results remain unwrapped without forwarding upstream headers", async (t) => {
  const payload = { status: "success", code: 201, message: "Recorded", nbVoteRemaining: 2 };
  const handler = createHandler({ env });
  for (const status of [200, 201]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(payload, { status, headers: {
      "Retry-After": "15", "Set-Cookie": "private=value", "X-Upstream-Internal": "private",
    } }));
    const response = await handler(request("?mode=addVote&showVoteUuid=show&userRef=voter", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"nbPoints":1}',
    }));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), payload);
    assert.equal(response.headers.get("retry-after"), null);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("x-upstream-internal"), null);
    assert.equal(response.headers.get("access-control-expose-headers"), null);
  }
});

test("non-JSON upstream errors retain their original body, content type and status", async (t) => {
  for (const text of ["<html>Unavailable</html>", ""]) {
    t.mock.method(globalThis, "fetch", async () => new Response(text, {
      status: 503, headers: { "Content-Type": "text/html", "Retry-After": "10", "Set-Cookie": "private=value" },
    }));
    const response = await createHandler({ env })(request("?mode=getShowVote&uuid=show"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("content-type"), "text/html");
    assert.equal(response.headers.get("retry-after"), null);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(await response.text(), text);
  }
});

test("invalid upstream success JSON is a 502 response", async (t) => {
  for (const text of ["", "{", "null", "[]"]) {
    t.mock.method(globalThis, "fetch", async () => new Response(text));
    const response = await createHandler({ env })(request("?mode=getShowVote&uuid=show"));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { status: "error", code: 502, message: "DV Live API returned an invalid JSON response." });
  }
});

test("concurrent Edge Function requests keep their bearer tokens separate", async (t) => {
  const seen = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    await Promise.resolve();
    seen.push(options.headers.get("authorization"));
    return Response.json({ name: "Show" });
  });
  const handler = createHandler({ env });
  const responses = await Promise.all(["first", "second"].map((token) => handler(request("?mode=getShowVote&uuid=show", { headers: { "bearer-token": token } }))));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.deepEqual(seen, ["Bearer first", "Bearer second"]);
});

test("network errors, timeout and missing secrets", async (t) => {
  for (const [name, status] of [["TypeError", 502], ["TimeoutError", 504]]) {
    t.mock.method(globalThis, "fetch", async () => { throw new DOMException("failure", name); });
    const handler = createHandler({ env });
    assert.equal((await handler(request("?mode=getShowVote&uuid=test"))).status, status);
  }
  const handler = createHandler({ env: () => undefined });
  assert.equal((await handler(request("?mode=getShowVote&uuid=test"))).status, 500);
  assert.equal((await handler(request())).status, 200);
    for (const value of ["", "stag", "DEV", "constructor"]) {
    const invalidConfig = createHandler({ env: () => value });
    const response = await invalidConfig(request("?mode=getShowVote&uuid=test"));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).message, 'Configure DVLIVE_ENV as "STAG" or "PROD" on the server.');
  }
});

test("validation rejects invalid inputs without calling upstream", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected upstream call"); });
  const handler = createHandler({ env });

  for (const [body, status] of [["{", 400], ["[]", 400], ['{"unexpected":1}', 400], ['{"votes":[]}', 400]]) {
    assert.equal((await handler(request("?mode=castVote&showVoteUuid=show&userRef=voter", { method: "POST", headers: { "Content-Type": "application/json" }, body }))).status, status);
  }
  assert.equal((await handler(request("?mode=createVoter&showVoteUuid=show", { method: "POST", body: "{}" }))).status, 415);
  assert.equal((await handler(request("?mode=getVoter&showVoteUuid=show&userRef=.."))).status, 400);
  for (const [mode, body] of [["createVoter", { phone: 123 }], ["addVote", { nbPoints: -1 }], ["addVote", { additionalVoteType: "INVALID" }], ["addVote", { additionalVoteType: ["VIDEO"] }], ["castVote", { votes: [{ choiceUuid: "choice", nbVotes: 1 }], ip: false }]]) {
    const response = await handler(request(`?mode=${mode}&showVoteUuid=show&userRef=voter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal(response.status, 400);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("SDK parameter validation errors are converted to HTTP 400 without upstream calls", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
  const handler = createHandler({ env });
  for (const [mode, parameter, query, body] of [
    ["getShowVote", "uuid", ""],
    ["getShowVoteChoice", "uuid", ""],
    ["getVoter", "showVoteUuid", "userRef=voter"],
    ["getVoter", "userRef", "showVoteUuid=show"],
    ["createVoter", "showVoteUuid", "", {}],
    ["addVote", "userRef", "showVoteUuid=show", {}],
    ["castVote", "userRef", "showVoteUuid=show", { votes: [{ choiceUuid: "choice", nbVotes: 1 }] }],
  ]) {
    for (const value of [null, "", " ", ".", ".."]) {
      const url = new URL(`https://proxy.test/?mode=${mode}&${query}`);
      if (value !== null) url.searchParams.set(parameter, value);
      const response = await handler(request(url.search, body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).message, `${parameter} must be a non-empty path parameter.`);
    }
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("SDK body validation errors are converted to HTTP 400", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected HTTP request"); });
  const handler = createHandler({ env });
  const cases = [
    ["createVoter", { email: false }, "email must be a string."],
    ["createVoter", { uniqRef: 1 }, "uniqRef must be a string."],
    ["createVoter", null, "The request body must be a JSON object."],
    ["addVote", { nbPoints: 0 }, "nbPoints must be a positive integer."],
    ["addVote", { unexpected: true }, "Unknown body fields: unexpected."],
    ["castVote", { votes: [{ choiceUuid: "choice", nbVotes: 1 }], ip: null }, "ip must be a string."],
  ];
  for (const [mode, body, message] of cases) {
    const response = await handler(request(`?mode=${mode}&showVoteUuid=show&userRef=voter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: "error", code: 400, message });
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("Supabase auth is not reused as the DV Live token", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => { calls++; throw new Error("Unexpected upstream call"); });
  const handler = createHandler({ env });
  const response = await handler(new Request("http://localhost/?mode=getShowVote&uuid=show", {
    headers: { Authorization: "Bearer supabase-jwt" },
  }));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  const preflight = await handler(request("", { method: "OPTIONS" }));
  assert.match(preflight.headers.get("access-control-allow-headers"), /bearer-token/);
});

test("each mode smoke script exercises only its own mode through curl adapter", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dvlive-smoke-"));
  const handlerUrl = pathToFileURL(resolve("supabase/functions/dvlive/index.ts")).href;
  try {
    // A curl-compatible adapter runs the real handler without opening a network port.
    await writeFile(join(dir, "curl"), `#!/usr/bin/env node
const { writeFile } = require("node:fs/promises");
(async () => {
  require("node:module").registerHooks({ resolve(specifier, context, next) {
    return next(specifier === "@digitalvirgo/dvlive-api" ? ${JSON.stringify(sdkUrl)} : specifier, context);
  } });
  const { createHandler } = await import(${JSON.stringify(handlerUrl)});
  const args = process.argv.slice(2), headers = {};
  let method, body, output, dump, url;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--silent" || arg === "--show-error") continue;
    if (arg === "--header") { const value = args[++i]; const colon = value.indexOf(":"); headers[value.slice(0, colon)] = value.slice(colon + 1).trim(); }
    else if (arg === "--request") method = args[++i];
    else if (arg === "--data-raw") body = args[++i];
    else if (arg === "--output") output = args[++i];
    else if (arg === "--dump-header") dump = args[++i];
    else if (arg === "--write-out" || arg === "--max-time" || arg === "--connect-timeout") i++;
    else url = arg;
  }
  if (headers.Authorization !== "Bearer supabase-jwt" || headers.apikey !== "supabase-jwt") throw new Error("Wrong Supabase auth");
  const selectedMode = new URL(url).searchParams.get("mode");
  const { parseMode } = await import(${JSON.stringify(sdkUrl)});
  if (process.env.EXPECTED_MODE === "catalog" ? parseMode(selectedMode).mode !== null : selectedMode !== process.env.EXPECTED_MODE) {
    throw new Error("Smoke script called another mode: " + selectedMode);
  }
  globalThis.fetch = async (url, options) => {
      if (options.headers.get("authorization") !== "Bearer test-token") throw new Error("Wrong upstream auth");
      if (url.pathname.includes("a/b")) throw new Error("Unescaped userRef");
      const payload = options.body ? JSON.parse(options.body) : null;
      if (selectedMode === "createVoter" && payload.uniqRef !== "a/b") throw new Error("Wrong voter");
      if (selectedMode === "addVote" && payload.nbPoints !== 3) throw new Error("Wrong points");
      if (selectedMode === "castVote" && payload.votes[0].choiceUuid !== "choice") throw new Error("Wrong votes");
      return Response.json({ status: "success", code: options.method === "POST" ? 201 : 200, message: "Success", nbVoteRemaining: 2, showVoteUuid: "show", uuid: "choice", firstname: "First", lastname: "Last", order: 1,
        name: "Show", startDate: "2026-01-01", endDate: "2026-12-31", uniqRef: "a/b", remainingPoints: 1, userFraudStatus: "CLEAN", balance: {}
      }, { status: options.method === "POST" ? 201 : 200 });
  };
  const handler = createHandler({ env: () => "STAG" });
  const response = await handler(new Request(url, { method, headers, ...(body === undefined ? {} : { body }) }));
  await writeFile(output, await response.text());
  process.stdout.write(String(response.status));
})().catch((error) => { console.error(error); process.exitCode = 1; });
`, { mode: 0o700 });
    const environment = {
      ...process.env, PATH: dir + ":" + process.env.PATH,
      SUPABASE_URL: "https://project.test", SUPABASE_ANON_KEY: "supabase-jwt",
      DVLIVE_BEARER_TOKEN: "test-token", SHOW_VOTE_UUID: "show", CHOICE_UUID: "choice", USER_REF: "a/b", NB_POINTS: "3",
    };
    for (const key of ["VOTES", "OUT_FILE", "EXPECTED_STATUS"]) delete environment[key];
    const run = promisify(execFile);
    const scripts = {
      catalog: "catalog", getShowVoteChoice: "get-show-vote-choice", getShowVote: "get-show-vote",
      getVoter: "get-voter", createVoter: "create-voter", addVote: "add-vote", castVote: "cast-vote",
    };
    for (const [mode, name] of Object.entries(scripts)) {
      const script = `script/smoke-${name}.sh`;
      const testEnv = { ...environment, EXPECTED_MODE: mode };
      if (mode === "catalog") delete testEnv.DVLIVE_BEARER_TOKEN;
      const { stdout } = await run("bash", [script], { env: testEnv });
      assert.match(stdout, new RegExp(`PASS: ${mode} response is valid`));
      assert.match(stdout, /URL: https:\/\/project.test\/functions\/v1\/dvlive/);
      const { stdout: help } = await run("bash", [script, "--help"]);
      assert.ok(help.includes(script));
      await assert.rejects(run("bash", [script, "--unknown"]));
      if (mode !== "catalog") {
        await assert.rejects(run("bash", [script], { env: { ...testEnv, DVLIVE_BEARER_TOKEN: " " } }));
      }
    }
    const outputPath = join(dir, "result.json");
    await run("bash", ["script/smoke-get-show-vote.sh"], { env: { ...environment, EXPECTED_MODE: "getShowVote", OUT_FILE: outputPath } });
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).name, "Show");
    await assert.rejects(run("bash", ["script/smoke-add-vote.sh"], { env: { ...environment, NB_POINTS: "-1" } }));
    await assert.rejects(run("bash", ["script/smoke-cast-vote.sh"], { env: { ...environment, VOTES: "[]" } }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
NODE
