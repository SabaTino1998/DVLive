import { test } from "node:test";
import assert from "node:assert/strict";
import { create, getNumericDate } from '@jsr/zaubrik__djwt';
import { edgeModule } from './load-edge.mjs';
import { show } from "../supabase/functions/_shared/dvlive-sdk/test/responses.fixture.mjs";

globalThis.Deno ??= { env: { get: () => undefined }, serve: () => {} };
const { createHandler } = await import(await edgeModule('../supabase/functions/dvlive/index.ts'));
const secret = 'test-only-jwt-secret-at-least-32-bytes';
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const jwt = await create({ alg: 'HS256', typ: 'JWT' }, { sub: 'profile', absolute_reference: 'voter-reference', app_role: 'app_user', exp: getNumericDate(60) }, key);
const request = () => new Request('https://edge.test/dvlive?mode=getShowVote&uuid=show', { headers: { Authorization: `Bearer ${jwt}` } });

test("Edge passes logging environment strings to SDK, with disabled/WARNING defaults", async (t) => {
  const logs = [];
  for (const method of ["warn", "info", "debug"]) t.mock.method(console, method, (...args) => logs.push(args));
  t.mock.method(globalThis, "fetch", async () => Response.json(show));
  const settings = {
    DVLIVE_API_TOKEN: 'private-token', DVLIVE_ENV: "STAG",
    APP_JWT_SECRET: secret,
    DVLIVE_ALB_TOKEN_STAG: "alb-dev-secret",
  };
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
  assert.equal(JSON.stringify(logs).includes("alb-dev-secret"), false);
});

test("invalid enabled log level is an Edge configuration error; catalog needs no config", async () => {
  const handle = createHandler({ env: name => ({ DVLIVE_API_TOKEN: 'private-token', DVLIVE_ENV: "STAG", APP_JWT_SECRET: secret, DVLIVE_LOG_ENABLE: "TRUE", DVLIVE_LOG_LEVEL: "INVALID" })[name] });
  assert.equal((await handle(request())).status, 500);
  const catalog = createHandler({ env: () => { throw new Error("Catalog must not read configuration"); } });
  assert.equal((await catalog(new Request("https://edge.test/dvlive"))).status, 200);
});
