import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../lib/authFlow.ts';
import { createDvLiveClient, DvLiveError } from '../lib/dvliveClient.ts';
import { registerSignupVoter } from '../lib/voterFlow.ts';

const config = { url: 'https://project.supabase.co', key: 'eyJ.anon-test', showUuid: 'show' };
function sdk() {
  const calls: unknown[] = [];
  return { calls, client: {
    async signupWithEmail(...args: string[]) { calls.push(['signup', ...args]); },
    async loginWithEmail(...args: string[]) { calls.push(['login', ...args]); },
    getUserToken() { calls.push(['token']); return 'N_login'; },
  } };
}
test('signup uses the signup session, without a second login, as in Bravigo', async () => {
  const fake = sdk();
  assert.deepEqual(await authenticate(fake.client, true, 'test@example.test', 'password'), { email: 'test@example.test', userToken: 'N_login', needsRegistration: true });
  assert.deepEqual(fake.calls, [['signup', 'test@example.test', 'password'], ['token']]);
});
test('login uses loginWithEmail and never creates a new account', async () => {
  const fake = sdk();
  assert.equal((await authenticate(fake.client, false, 'test@example.test', 'password')).needsRegistration, false);
  assert.deepEqual(fake.calls, [['login', 'test@example.test', 'password'], ['token']]);
});
test('voter requests use the app JWT and omit caller-controlled references', async () => {
  let token = 'jwt-first'; const calls: { url: URL; options?: RequestInit }[] = [];
  const send: typeof fetch = async (input, options) => {
    calls.push({ url: new URL(String(input)), options });
    return Response.json({ ok: true, data: { status: 'success' } });
  };
  const client = createDvLiveClient(config, () => token, send);
  await client.createVoter('test@example.test');
  token = 'jwt-second';
  await client.voter();
  assert.equal(calls[0].url.searchParams.get('mode'), 'createVoter');
  assert.deepEqual(JSON.parse(calls[0].options!.body as string), { email: 'test@example.test' });
  assert.equal(calls[1].url.searchParams.get('userRef'), null);
  assert.equal(calls[1].url.searchParams.get('showVoteUuid'), 'show');
  assert.equal(new Headers(calls[1].options!.headers).get('bearer-token'), null);
  assert.equal(new Headers(calls[1].options!.headers).get('Authorization'), `Bearer ${token}`);
  assert.equal(new Headers(calls[1].options!.headers).get('apikey'), config.key);
});
test('show and detail map to the existing Edge Function modes', async () => {
  const modes: URL[] = [];
  const client = createDvLiveClient(config, () => 'N_login', async input => { modes.push(new URL(String(input))); return Response.json({ ok: true, data: {} }); });
  await client.show(); await client.choice('choice/a');
  assert.equal(modes[0].searchParams.get('mode'), 'getShowVote');
  assert.equal(modes[0].searchParams.get('uuid'), 'show');
  assert.equal(modes[1].searchParams.get('mode'), 'getShowVoteChoice');
  assert.equal(modes[1].searchParams.get('uuid'), 'choice/a');
});
test('getVoter preserves upstream 404 and does not create a replacement voter', async () => {
  let calls = 0;
  const client = createDvLiveClient(config, () => 'N_login', async () => { calls++; return Response.json({ ok: false, error: { message: 'Voter not found', code: 'NOT_FOUND', details: { upstream: 'missing' } } }, { status: 404 }); });
  await assert.rejects(client.voter(), error => error instanceof DvLiveError && error.status === 404 && error.message === 'Voter not found' && error.code === 'NOT_FOUND' && (error.details as { upstream: string }).upstream === 'missing');
  assert.equal(calls, 1);
});
test('two mounts of the signup screen do not create two voters', async () => {
  let creates = 0;
  const create = async () => { creates++; };
  await Promise.all([registerSignupVoter('N_registration', create), registerSignupVoter('N_registration', create)]);
  assert.equal(creates, 1);
});
test('failed voter registration can be retried', async () => {
  await assert.rejects(registerSignupVoter('N_retry', async () => { throw new Error('offline'); }), /offline/);
  await registerSignupVoter('N_retry', async () => {});
});
test('voter request fails when no user JWT is available', async () => {
  const client = createDvLiveClient(config, async () => { throw new Error('No app session'); }, () => { throw new Error('Unexpected request'); });
  await assert.rejects(client.voter(), /No app session/);
});
test('a 401 renews the JWT once and retries with the refreshed token', async () => {
  const headers: string[] = [];
  const forces: (boolean | undefined)[] = [];
  const client = createDvLiveClient(config, force => { forces.push(force); return force ? 'fresh' : 'old'; }, async (_url, options) => {
    headers.push(new Headers(options!.headers).get('Authorization')!);
    return headers.length === 1 ? Response.json({ message: 'Expired' }, { status: 401 }) : Response.json({ ok: true, data: {} });
  });
  await client.voter();
  assert.deepEqual(headers, ['Bearer old', 'Bearer fresh']);
  assert.deepEqual(forces, [undefined, true]);
});

test('all five BBM commands use the app JWT, unwrap data and omit client identity', async () => {
  const calls: { url: URL; options: RequestInit }[] = [];
  const data = { round: { choices: [{ uuid: 'choice' }] }, remainingPoints: 3 };
  const client = createDvLiveClient(config, () => 'app-jwt', async (input, options) => {
    calls.push({ url: new URL(String(input)), options: options! });
    return Response.json({ ok: true, data }, { status: options!.method === 'POST' ? 201 : 200 });
  });
  assert.deepEqual(await client.show(), data);
  assert.deepEqual(await client.choice('choice'), data);
  assert.deepEqual(await client.createVoter(), data);
  assert.deepEqual(await client.voter(), data);
  assert.deepEqual(await client.castVote({
    votes: [{ choiceUuid: 'choice', nbVotes: 1 }], sessionToken: 'session',
    phoneFingerPrint: 'fingerprint', ip: '127.0.0.1', userAgent: 'test', uniqSubscriptionId: 'subscription',
    ...{ uniqRef: 'attacker', userRef: 'attacker' },
  }), data);
  assert.deepEqual(calls.map(call => call.url.searchParams.get('mode')), ['getShowVote', 'getShowVoteChoice', 'createVoter', 'getVoter', 'castVote']);
  for (const { url, options } of calls) {
    const headers = new Headers(options.headers);
    assert.equal(headers.get('Authorization'), 'Bearer app-jwt');
    assert.equal(headers.get('apikey'), config.key);
    assert.equal(headers.get('bearer-token'), null);
    assert.equal(url.searchParams.has('userRef'), false);
    assert.equal(url.searchParams.has('uniqRef'), false);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['mode', url.searchParams.has('uuid') ? 'uuid' : 'showVoteUuid'].sort());
    if (options.body) {
      const body = JSON.parse(String(options.body));
      assert.equal('uniqRef' in body, false);
      assert.equal('userRef' in body, false);
      assert.equal(headers.get('Content-Type'), 'application/json');
    }
  }
  assert.deepEqual(JSON.parse(String(calls[4].options.body)), {
    votes: [{ choiceUuid: 'choice', nbVotes: 1 }], sessionToken: 'session',
    phoneFingerPrint: 'fingerprint', ip: '127.0.0.1', userAgent: 'test', uniqSubscriptionId: 'subscription',
  });
});

test('every command refreshes a rejected JWT only once', async () => {
  for (const mode of ['show', 'choice', 'createVoter', 'voter', 'castVote'] as const) {
    const forces: (boolean | undefined)[] = [];
    const headers: string[] = [];
    const client = createDvLiveClient(config, force => { forces.push(force); return force ? 'fresh' : 'old'; }, async (_input, options) => {
      headers.push(new Headers(options!.headers).get('Authorization')!);
      return Response.json({ ok: false, error: { message: 'Sign in', code: 'AUTH_REQUIRED', details: null } }, { status: 401 });
    });
    const call = () => mode === 'choice' ? client.choice('choice') : mode === 'castVote' ? client.castVote({ votes: [{ choiceUuid: 'choice', nbVotes: 1 }] }) : client[mode]();
    await assert.rejects(call, error => error instanceof DvLiveError && error.status === 401 && error.code === 'AUTH_REQUIRED');
    assert.deepEqual(headers, ['Bearer old', 'Bearer fresh']);
    assert.deepEqual(forces, [undefined, true]);
  }
});

test('forbidden envelopes expose details and do not refresh the session', async () => {
  let requests = 0;
  const client = createDvLiveClient(config, () => 'jwt', async () => {
    requests++;
    return Response.json({ ok: false, error: { message: 'Forbidden', code: 'FORBIDDEN', details: { reason: 'identity' } } }, { status: 403 });
  });
  await assert.rejects(client.show(), error => {
    assert.ok(error instanceof DvLiveError);
    assert.equal(error.message, 'Forbidden');
    assert.equal(error.code, 'FORBIDDEN');
    assert.deepEqual(error.details, { reason: 'identity' });
    return true;
  });
  assert.equal(requests, 1);
});

test('an error envelope is rejected even with a successful HTTP status', async () => {
  const client = createDvLiveClient(config, () => 'jwt', async () => Response.json({ ok: false, error: { message: 'Vote rejected', code: 'VOTE_REJECTED', details: null } }));
  await assert.rejects(client.castVote({ votes: [{ choiceUuid: 'choice', nbVotes: 1 }] }), error => error instanceof DvLiveError && error.code === 'VOTE_REJECTED');
});

test('raw legacy responses and malformed envelopes are rejected', async () => {
  for (const body of [{ name: 'Legacy show' }, { ok: true }, null, 'invalid JSON']) {
    const client = createDvLiveClient(config, () => 'jwt', async () => typeof body === 'string' ? new Response(body) : Response.json(body));
    await assert.rejects(client.show(), error => error instanceof DvLiveError && error.status === 502);
  }
});

test('empty JWTs stop show requests before the network', async () => {
  const client = createDvLiveClient(config, () => '  ', () => { throw new Error('Unexpected request'); });
  await assert.rejects(client.show(), error => error instanceof DvLiveError && error.code === 'AUTH_REQUIRED');
});
