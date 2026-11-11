import test from 'node:test';
import assert from 'node:assert/strict';
import { create, getNumericDate } from '@jsr/zaubrik__djwt';
import { edgeModule } from './load-edge.mjs';
import { show } from '../supabase/functions/_shared/dvlive-sdk/test/responses.fixture.mjs';

globalThis.Deno = { env: { get: () => undefined }, serve: () => {} };
const { createHandler } = await import(await edgeModule('../supabase/functions/dvlive/index.ts'));

const SECRET = 'test-only-jwt-secret-at-least-32-bytes';
const appClaims = { absolute_reference: 'smartuser-absolute-reference', app_role: 'app_user' };
const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
);
const jwt = await create(
  { alg: 'HS256', typ: 'JWT' },
  { sub: 'profile', iat: getNumericDate(0), exp: getNumericDate(1500), ...appClaims },
  key,
);
const request = () => new Request('http://edge.test/dvlive?mode=getShowVote&uuid=show', {
  headers: { Authorization: `Bearer ${jwt}` },
});

function quiet(t) {
  for (const method of ['log', 'debug', 'info', 'warn', 'error']) t.mock.method(console, method, () => {});
}

test('optional ALB token is selected directly by DVLIVE_ENV', async t => {
  quiet(t);
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show, { status: 200 }));

  const without = createHandler({
    env: name => ({ DVLIVE_ENV: 'STAG', DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET })[name],
  });
  assert.equal((await without(request())).status, 200);
  assert.equal(capture.mock.calls[0].arguments[1].headers.get('Authorization'), 'Bearer api-token');
  assert.equal(capture.mock.calls[0].arguments[1].headers.get('X-Internal-Auth'), null);

  const stag = createHandler({
    env: name => ({
      DVLIVE_ENV: 'STAG',
      DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_DEV: 'alb-dev-token',
      DVLIVE_ALB_TOKEN_STAG: 'alb-stag-token',
    })[name],
  });
  assert.equal((await stag(request())).status, 200);
  assert.equal(capture.mock.calls[1].arguments[1].headers.get('Authorization'), 'Bearer api-token');
  assert.equal(capture.mock.calls[1].arguments[1].headers.get('X-Internal-Auth'), 'alb-stag-token');

  const stagOnly = createHandler({
    env: name => ({
      DVLIVE_ENV: 'STAG',
      DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_STAG: 'alb-stag-token',
    })[name],
  });
  assert.equal((await stagOnly(request())).status, 200);
  assert.equal(capture.mock.calls[2].arguments[1].headers.get('X-Internal-Auth'), 'alb-stag-token');

  const prod = createHandler({
    env: name => ({
      DVLIVE_ENV: 'PROD',
      DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_PROD: 'alb-prod-token',
    })[name],
  });
  const prodResponse = await prod(request());
  assert.equal(prodResponse.status, 200);
  assert.equal(capture.mock.calls[3].arguments[1].headers.get('X-Internal-Auth'), 'alb-prod-token');
  assert.equal(JSON.stringify(await prodResponse.json()).includes('alb-prod-token'), false);

  const blank = createHandler({
    env: name => ({
      DVLIVE_ENV: 'STAG',
      DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_DEV: '   ',
    })[name],
  });
  assert.equal((await blank(request())).status, 200);
  assert.equal(capture.mock.calls[4].arguments[1].headers.get('X-Internal-Auth'), null);
});

for (const [environment, host] of [
  ['DEV', 'dev-webshow-engine.dv-live.com'],
  ['STAG', 'stag-webshow-engine.dv-live.com'],
  ['PROD', 'webshow-engine.dv-live.com'],
]) {
  test(`${environment} selects its upstream host and ALB token with upstream bearer authentication`, async t => {
    quiet(t);
    const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show));
    const secrets = {
      DVLIVE_ENV: ` ${environment} `,
      DVLIVE_ALB_TOKEN_DEV: ' dev-alb-token ',
      DVLIVE_ALB_TOKEN_STAG: ' stag-alb-token ',
      DVLIVE_ALB_TOKEN_PROD: ' prod-alb-token ',
      DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
    };
    const reads = [];
    const handle = createHandler({ env: name => { reads.push(name); return secrets[name]; } });
    assert.equal((await handle(request())).status, 200);
    const [url, options] = capture.mock.calls[0].arguments;
    assert.equal(url.hostname, host);
    assert.deepEqual(reads.filter(name => name.startsWith('DVLIVE_ALB_TOKEN_')), [`DVLIVE_ALB_TOKEN_${environment}`]);
    assert.equal(options.headers.get('Authorization'), 'Bearer api-token');
    assert.equal(options.headers.get('X-Internal-Auth'), `${environment.toLowerCase()}-alb-token`);

    secrets[`DVLIVE_ALB_TOKEN_${environment}`] = '   ';
    assert.equal((await handle(request())).status, 200);
    assert.equal(capture.mock.calls[1].arguments[1].headers.get('X-Internal-Auth'), null);
    assert.equal(capture.mock.calls[1].arguments[1].headers.get('Authorization'), 'Bearer api-token');
  });
}

for (const environment of ['DEV', 'STAG', 'PROD']) {
  for (const mode of ['INT', 'PROD']) {
    test(`${mode}/${environment} selects matching host and bearer and mode-specific ALB authentication`, async t => {
      quiet(t);
      const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show));
      const reads = [];
      const secrets = {
        DVLIVE_ENV: environment, DVLIVE_MODE: ` ${mode} `,
        APP_JWT_SECRET: SECRET, [`DVLIVE_ALB_TOKEN_${environment}`]: ' alb-token ',
        DVLIVE_API_TOKEN: ' api-token ',
      };
      const handle = createHandler({ env: name => { reads.push(name); return secrets[name]; } });
      assert.equal((await handle(request())).status, 200);
      const [url, options] = capture.mock.calls[0].arguments;
      const prefix = environment === 'PROD' ? '' : `${environment.toLowerCase()}-`;
      assert.equal(url.hostname, `${mode === 'INT' ? 'int-' : ''}${prefix}webshow-engine.dv-live.com`);
      assert.equal(options.headers.get('Authorization'), 'Bearer api-token');
      assert.equal(options.headers.get('X-Internal-Auth'), mode === 'PROD' ? 'alb-token' : null);
      if (mode === 'INT') assert.deepEqual(reads.filter(name => name.startsWith('DVLIVE_ALB_TOKEN_')), []);
      assert.equal(reads.includes('DVLIVE_API_TOKEN'), true);
    });
  }
}

test('invalid access modes reject operations without upstream requests; catalog stays available', async t => {
  quiet(t);
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show));
  for (const mode of ['', 'LOCAL', 'int', 'INVALID']) {
    const handle = createHandler({ env: name => ({
      DVLIVE_ENV: 'STAG', DVLIVE_MODE: mode, DVLIVE_API_TOKEN: ' api-token ', APP_JWT_SECRET: SECRET,
    })[name] });
    assert.equal((await handle(request())).status, 500);
    assert.equal((await handle(new Request('http://edge.test/dvlive'))).status, 200);
  }
  assert.equal(capture.mock.callCount(), 0);
});

test('both modes require a nonblank configured bearer token before upstream requests', async t => {
  quiet(t);
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show));
  for (const mode of ['INT', 'PROD', undefined]) {
    for (const token of [undefined, '', '   ']) {
      const handle = createHandler({ env: name => ({
        DVLIVE_ENV: 'DEV', DVLIVE_MODE: mode, APP_JWT_SECRET: SECRET,
        DVLIVE_API_TOKEN: token,
      })[name] });
      const response = await handle(request());
      assert.equal(response.status, 500);
      assert.equal((await response.json()).error.code, 'SERVER_MISCONFIGURED');
      assert.equal((await handle(new Request('http://edge.test/dvlive'))).status, 200);
    }
  }
  assert.equal(capture.mock.callCount(), 0);
});
