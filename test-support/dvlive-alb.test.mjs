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

test('optional ALB tokens set X-Internal-Auth from the upstream host', async t => {
  quiet(t);
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json(show, { status: 200 }));

  const without = createHandler({
    env: name => ({ DVLIVE_ENV: 'STAG', DVLIVE_API_TOKEN: 'server-token', APP_JWT_SECRET: SECRET })[name],
  });
  assert.equal((await without(request())).status, 200);
  assert.equal(capture.mock.calls[0].arguments[1].headers.get('Authorization'), 'Bearer server-token');
  assert.equal(capture.mock.calls[0].arguments[1].headers.get('X-Internal-Auth'), null);

  const stagUsesDev = createHandler({
    env: name => ({
      DVLIVE_ENV: 'STAG',
      DVLIVE_API_TOKEN: 'server-token',
      APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_DEV: 'alb-dev-token',
      DVLIVE_ALB_TOKEN_STAG: 'alb-stag-token',
    })[name],
  });
  assert.equal((await stagUsesDev(request())).status, 200);
  assert.equal(capture.mock.calls[1].arguments[1].headers.get('Authorization'), 'Bearer server-token');
  assert.equal(capture.mock.calls[1].arguments[1].headers.get('X-Internal-Auth'), 'alb-dev-token');

  const stagOnly = createHandler({
    env: name => ({
      DVLIVE_ENV: 'STAG',
      DVLIVE_API_TOKEN: 'server-token',
      APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_STAG: 'alb-stag-token',
    })[name],
  });
  assert.equal((await stagOnly(request())).status, 200);
  assert.equal(capture.mock.calls[2].arguments[1].headers.get('X-Internal-Auth'), null);

  const prod = createHandler({
    env: name => ({
      DVLIVE_ENV: 'PROD',
      DVLIVE_API_TOKEN: 'server-token',
      APP_JWT_SECRET: SECRET,
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
      DVLIVE_API_TOKEN: 'server-token',
      APP_JWT_SECRET: SECRET,
      DVLIVE_ALB_TOKEN_DEV: '   ',
    })[name],
  });
  assert.equal((await blank(request())).status, 200);
  assert.equal(capture.mock.calls[4].arguments[1].headers.get('X-Internal-Auth'), null);
});
