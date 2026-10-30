import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { show } from "./responses.fixture.mjs";

// Exercise the real HTTP adapter against the built public package without Deno
// or modifying its deployment import map / runtime bootstrap.
const source = await readFile(new URL("../../../dvlive/index.ts", import.meta.url), "utf8");
const adapter = source.slice(0, source.indexOf("export const handleRequest"))
  .replace('from "@digitalvirgo/dvlive-api"', `from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)}`);
const { outputText } = ts.transpileModule(adapter, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createHandler } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const request = () => new Request("https://edge.test/dvlive?mode=getShowVote&uuid=show", { headers: { "bearer-token": "private-token" } });

test("Edge passes logging environment strings to SDK, with disabled/WARNING defaults", async (t) => {
  const logs = [];
  for (const method of ["warn", "info", "debug"]) t.mock.method(console, method, (...args) => logs.push(args));
  t.mock.method(globalThis, "fetch", async () => Response.json(show));
  const settings = { DVLIVE_ENV: "STAG" };
  const handle = createHandler({ env: name => settings[name] });
  assert.equal((await handle(request())).status, 200);
  assert.equal(logs.length, 0);
  settings.DVLIVE_LOG_ENABLE = "TRUE";
  assert.equal((await handle(request())).status, 200);
  assert.equal(logs.length, 0);
  settings.DVLIVE_LOG_LEVEL = "DEBUG";
  assert.equal((await handle(request())).status, 200);
  assert.ok(logs.some(([prefix]) => prefix.includes("DEBUG")));
  assert.equal(JSON.stringify(logs).includes("private-token"), false);
});

test("invalid enabled log level is an Edge configuration error; catalog needs no config", async () => {
  const handle = createHandler({ env: name => ({ DVLIVE_ENV: "STAG", DVLIVE_LOG_ENABLE: "TRUE", DVLIVE_LOG_LEVEL: "INVALID" })[name] });
  assert.equal((await handle(request())).status, 500);
  const catalog = createHandler({ env: () => { throw new Error("Catalog must not read configuration"); } });
  assert.equal((await catalog(new Request("https://edge.test/dvlive"))).status, 200);
});
