#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --input-type=module - <<'NODE'
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHandler } from "./supabase/functions/dvlive/index.ts";

const env = (key) => ({ DVLIVE_BASE_URL: "https://upstream.test/api/" })[key];
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
      assert.equal(url.href, `https://upstream.test/api${path}`);
      assert.equal(options.method, body ? "POST" : "GET");
      assert.equal(options.headers.Authorization, "Bearer upstream-secret");
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

test("upstream failures preserve status, payload and Retry-After", async (t) => {
  for (const status of [401, 403, 404, 409, 422, 429, 500]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ code: status, message: "error" }, { status, headers: { "Retry-After": "30" } }));
    const handler = createHandler({ env });
    const response = await handler(request("?mode=getShowVote&uuid=test"));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("retry-after"), "30");
    assert.deepEqual(await response.json(), { code: status, message: "error" });
  }
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
});

test("validation rejects invalid inputs without calling upstream", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected upstream call"); });
  const handler = createHandler({ env });
  for (const mode of ["__proto__", "constructor", "toString"]) assert.equal((await handler(request(`?mode=${mode}`))).status, 400);
  for (const [body, status] of [["{", 400], ["[]", 400], ['{"unexpected":1}', 400], ['{"votes":[]}', 400]]) {
    assert.equal((await handler(request("?mode=castVote&showVoteUuid=show&userRef=voter", { method: "POST", headers: { "Content-Type": "application/json" }, body }))).status, status);
  }
  assert.equal((await handler(request("?mode=createVoter&showVoteUuid=show", { method: "POST", body: "{}" }))).status, 415);
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
  if (process.env.EXPECTED_MODE === "catalog" ? (selectedMode && selectedMode !== "unknown") : selectedMode !== process.env.EXPECTED_MODE) {
    throw new Error("Smoke script called another mode: " + selectedMode);
  }
  globalThis.fetch = async (url, options) => {
      if (options.headers.Authorization !== "Bearer test-token") throw new Error("Wrong upstream auth");
      if (url.pathname.includes("a/b")) throw new Error("Unescaped userRef");
      const payload = options.body ? JSON.parse(options.body) : null;
      if (selectedMode === "createVoter" && payload.uniqRef !== "a/b") throw new Error("Wrong voter");
      if (selectedMode === "addVote" && payload.nbPoints !== 3) throw new Error("Wrong points");
      if (selectedMode === "castVote" && payload.votes[0].choiceUuid !== "choice") throw new Error("Wrong votes");
      return Response.json({ status: "success", code: 200, message: "Success", showVoteUuid: "show", uuid: "choice", firstname: "First", lastname: "Last", order: 1,
        name: "Show", startDate: "2026-01-01", endDate: "2026-12-31", uniqRef: "a/b", remainingPoints: 1, userFraudStatus: "CLEAN", balance: {}
      }, { status: options.method === "POST" && url.pathname.endsWith("/voter") ? 201 : 200 });
  };
  const handler = createHandler({ env: () => "https://upstream.test" });
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
        await assert.rejects(run("bash", [script], { env: { ...testEnv, DVLIVE_BEARER_TOKEN: "" } }));
      }
    }
    const outputPath = join(dir, "result.json");
    await run("bash", ["script/smoke-get-show-vote.sh"], { env: { ...environment, EXPECTED_MODE: "getShowVote", OUT_FILE: outputPath } });
    const { readFile } = await import("node:fs/promises");
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).name, "Show");
    await assert.rejects(run("bash", ["script/smoke-add-vote.sh"], { env: { ...environment, NB_POINTS: "-1" } }));
    await assert.rejects(run("bash", ["script/smoke-cast-vote.sh"], { env: { ...environment, VOTES: "[]" } }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
NODE
