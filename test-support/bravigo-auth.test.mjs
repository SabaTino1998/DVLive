import test from 'node:test';
import assert from 'node:assert/strict';
import { create, getNumericDate, verify } from '@jsr/zaubrik__djwt';
import { edgeModule } from './load-edge.mjs';

const USER = 'ee120e3a-03df-4c2a-b469-0b0e80034cd1';
const SERVICE = '1927f41e-a809-49c9-9661-5a54a6177069';
const PRODUCT = '8a236df7-f1da-49d9-a255-d851b180b162';
const SECRET = 'test-only-jwt-secret-at-least-32-bytes';
let settings = {};
let proxy;
globalThis.Deno = { env: { get: name => settings[name] }, serve: handler => { proxy = handler; } };
await import(await edgeModule('../supabase/functions/bolt-auth-proxy/index.ts'));
const { createHandler } = await import(await edgeModule('../supabase/functions/dvlive/index.ts'));
const baseSettings = {
  BRAVIGO_SMART_USER_APP_ID: 'server-app', BRAVIGO_SMART_USER_APP_SECRET: 'server-test-secret',
  SMART_USER_APP_ENV: 'STAG', SUPABASE_URL: 'http://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role', SUPABASE_ANON_KEY: 'test-anon',
};
const appClaims = { absolute_reference: USER, app_role: 'app_user', service_id: SERVICE, product_id: PRODUCT };
const key = () => crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const sign = async (claims = {}, exp = getNumericDate(1500)) => create({ alg: 'HS256', typ: 'JWT' }, { sub: USER, iat: getNumericDate(0), exp, ...claims }, await key());
const proxyRequest = command => new Request('http://edge.test/bolt-auth-proxy', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command, service_slug: 'bravigo', userToken: 'N_test-session' }),
});
function quiet(t) {
  for (const method of ['log', 'debug', 'info', 'warn', 'error']) t.mock.method(console, method, () => {});
}
function upstream(t, localToken) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(String(input));
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, options, body });
    if (url.pathname.endsWith('/token/privileged_convert')) return Response.json({ absoluteReference: USER });
    if (url.pathname === '/rest/v1/bo_services') return Response.json({ id: SERVICE, slug: 'bravigo', display_name: 'Bravigo', status: 'active' });
    if (url.pathname === '/rest/v1/bo_products') return Response.json({ id: PRODUCT, slug: 'ma-bravigo', country_code: 'MA', display_name: 'Bravigo MA', native_bundle_id: null, hostname_staging: null, hostname_production: null });
    if (url.pathname === '/rest/v1/profiles') return new Response(null, { status: 201 });
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ id: USER, app_metadata: appClaims });
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: localToken, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: USER, app_metadata: appClaims } });
    throw new Error(`Unexpected test URL: ${url.pathname}`);
  });
  return calls;
}

test('original Bravigo proxy syncUser resolves product, upserts profile and signs the expected JWT', async t => {
  quiet(t); settings = { ...baseSettings, APP_JWT_SECRET: SECRET };
  const calls = upstream(t);
  const response = await proxy(proxyRequest('syncUser'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.data.absolute_reference, USER);
  assert.equal(result.data.expires_in, 1500);
  assert.equal(result.data.service_id, SERVICE);
  assert.equal(result.data.product_id, PRODUCT);
  const claims = await verify(result.data.access_token, await key());
  assert.equal(claims.sub, USER);
  assert.equal(claims.absolute_reference, USER);
  assert.equal(claims.app_role, 'app_user');
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.service_id, SERVICE);
  assert.equal(claims.product_id, PRODUCT);
  const profile = calls.find(call => call.url.pathname === '/rest/v1/profiles');
  assert.equal(profile.body.id, USER);
  assert.equal(profile.body.product_id, PRODUCT);
  assert.equal(profile.url.searchParams.get('on_conflict'), 'id,service_id,product_id');
});

test('original Bravigo local mode creates a GoTrue user and returns its session with app_metadata', async t => {
  quiet(t); settings = { ...baseSettings };
  const localToken = await sign({ role: 'authenticated', aud: 'authenticated', app_metadata: appClaims });
  const calls = upstream(t, localToken);
  const response = await proxy(proxyRequest('syncUser'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.access_token, localToken);
  assert.equal(result.data.expires_in, 3600);
  const createUser = calls.find(call => call.url.pathname === '/auth/v1/admin/users');
  assert.equal(createUser.body.id, USER);
  assert.equal(createUser.body.app_metadata.absolute_reference, USER);
  assert.equal(createUser.body.app_metadata.product_id, PRODUCT);
});

test('fetchCurrentUser and GET catalog preserve the original Bravigo contract', async t => {
  quiet(t); settings = { ...baseSettings, APP_JWT_SECRET: SECRET }; upstream(t);
  assert.deepEqual(await (await proxy(proxyRequest('fetchCurrentUser'))).json(), { ok: true, data: { absoluteReference: USER } });
  const catalog = await (await proxy(new Request('http://edge.test/bolt-auth-proxy'))).json();
  assert.deepEqual(catalog.commands, ['fetchCurrentUser', 'getIdentities', 'isPayingFor', 'syncUser']);
});

const voterRequest = (jwt, mode, body) => new Request(`http://edge.test/dvlive?mode=${mode}&showVoteUuid=show&userRef=attacker`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'bearer-token': 'dv-api-token', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('dvlive accepts Bravigo flat and app_metadata JWTs and ignores supplied user references', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ path: new URL(url).pathname, body: options.body && JSON.parse(options.body), authorization: options.headers.get('Authorization') });
    return options.method === 'GET'
      ? Response.json({ uniqRef: USER, remainingPoints: 1, userFraudStatus: 'CLEAN', balance: { standardPoint: 1 } })
      : Response.json({ status: 'success', code: 201, message: 'Recorded', nbVoteRemaining: 1 }, { status: 201 });
  });
  const handle = createHandler({ env: name => ({ DVLIVE_ENV: 'STAG', SUPABASE_JWT_SECRET: SECRET })[name] });
  for (const claims of [appClaims, { app_metadata: appClaims, aud: 'authenticated', iss: 'http://localhost/auth/v1' }]) {
    const jwt = await sign(claims);
    assert.equal((await handle(voterRequest(jwt, 'getVoter'))).status, 200);
    assert.equal((await handle(voterRequest(jwt, 'createVoter', { uniqRef: 'attacker', email: 'test@example.test' }))).status, 201);
    assert.equal((await handle(voterRequest(jwt, 'castVote', { votes: [{ choiceUuid: 'choice', nbVotes: 1 }] }))).status, 201);
  }
  assert.ok(calls.every(call => call.authorization === 'Bearer dv-api-token'));
  assert.ok(calls.filter(call => call.body?.email).every(call => call.body.uniqRef === USER));
  assert.ok(calls.filter(call => !call.body || call.body.votes).every(call => call.path.includes(`/voter/${USER}`)));
  assert.ok(!JSON.stringify(calls).includes('attacker'));
});

test('dvlive rejects missing, expired, forged and non-app JWTs before upstream access', async t => {
  const send = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected DVLive call'); });
  const handle = createHandler({ env: name => ({ DVLIVE_ENV: 'STAG', APP_JWT_SECRET: SECRET })[name] });
  const valid = await sign(appClaims);
  for (const jwt of ['', 'N_session', `${valid.slice(0, -8)}xxxxxxxx`, await sign(appClaims, getNumericDate(-20))]) {
    assert.equal((await handle(voterRequest(jwt, 'getVoter'))).status, 401);
  }
  assert.equal((await handle(voterRequest(await sign({ role: 'anon' }), 'getVoter'))).status, 403);
  assert.equal(send.mock.callCount(), 0);
});
