import test from 'node:test';
import assert from 'node:assert/strict';
import { create, getNumericDate } from '@jsr/zaubrik__djwt';
import { edgeModule } from './load-edge.mjs';

let settings = {};
globalThis.Deno = { env: { get: name => settings[name] } };
const { verifyAppJwt } = await import(await edgeModule('../supabase/functions/_shared/verify-app-jwt.ts'));
const request = token => new Request('http://edge.test', { headers: token === undefined ? {} : { Authorization: `Bearer ${token}` } });
const localSettings = { SUPABASE_URL: 'http://auth.test/', SUPABASE_ANON_KEY: 'public-anon-key' };
const metadata = { app_role: 'app_user', absolute_reference: 'smartuser-reference', service_id: 'service' };

test('missing signing secrets reject tokens without calling GoTrue, matching Bravigo', async t => {
  settings = { ...localSettings };
  const send = t.mock.method(globalThis, 'fetch', () => assert.fail('No GoTrue fallback'));
  const result = await verifyAppJwt(request('gotrue-session'));
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.message, 'JWT secret not configured');
  assert.equal(send.mock.callCount(), 0);
});

test('missing bearer token is rejected', async () => {
  settings = {};
  assert.equal((await verifyAppJwt(request())).status, 401);
});

test('configured signing secrets retain HS256 verification without calling GoTrue', async t => {
  const secret = 'test-only-signing-secret-at-least-32-bytes';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const send = t.mock.method(globalThis, 'fetch', () => assert.fail('No GoTrue fallback for custom JWTs'));
  for (const variable of ['APP_JWT_SECRET', 'SUPABASE_JWT_SECRET']) {
    settings = { ...localSettings, [variable]: secret };
    for (const claims of [metadata, { app_metadata: metadata }]) {
      const jwt = await create({ alg: 'HS256', typ: 'JWT' }, { sub: 'profile-uuid', exp: getNumericDate(60), ...claims }, key);
      const result = await verifyAppJwt(request(jwt));
      assert.equal(result.ok, true);
      assert.equal(result.claims.absolute_reference, 'smartuser-reference');
    }
    assert.equal((await verifyAppJwt(request('forged'))).status, 401);
    const expired = await create({ alg: 'HS256', typ: 'JWT' }, { sub: 'profile', exp: getNumericDate(-60), ...metadata }, key);
    assert.equal((await verifyAppJwt(request(expired))).status, 401);
  }
  assert.equal(send.mock.callCount(), 0);
});
