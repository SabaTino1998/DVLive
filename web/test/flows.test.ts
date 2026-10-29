import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../lib/authFlow.ts';
import { createDvLiveClient, DvLiveError } from '../lib/dvliveClient.ts';
import { registerSignupVoter } from '../lib/voterFlow.ts';

const config = { url: 'https://project.supabase.co', key: 'eyJ.anon-test', bearer: 'dv-bearer', showUuid: 'show' };
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
test('voter requests use the current SmartUser N token and correct Supabase headers', async () => {
  let token = 'N_first'; const calls: { url: URL; options?: RequestInit }[] = [];
  const send: typeof fetch = async (input, options) => {
    calls.push({ url: new URL(String(input)), options });
    return Response.json({ status: 'success' });
  };
  const client = createDvLiveClient(config, () => token, send);
  await client.createVoter('test@example.test');
  token = 'N_second/with|characters';
  await client.voter();
  assert.equal(calls[0].url.searchParams.get('mode'), 'createVoter');
  assert.deepEqual(JSON.parse(calls[0].options!.body as string), { uniqRef: 'N_first', email: 'test@example.test' });
  assert.equal(calls[1].url.searchParams.get('userRef'), token);
  assert.equal(calls[1].url.searchParams.get('showVoteUuid'), 'show');
  assert.equal(new Headers(calls[1].options!.headers).get('bearer-token'), config.bearer);
  assert.equal(new Headers(calls[1].options!.headers).get('Authorization'), `Bearer ${config.key}`);
  assert.equal(new Headers(calls[1].options!.headers).get('apikey'), config.key);
});
test('show and detail map to the existing Edge Function modes', async () => {
  const modes: URL[] = [];
  const client = createDvLiveClient(config, () => 'N_login', async input => { modes.push(new URL(String(input))); return Response.json({}); });
  await client.show(); await client.choice('choice/a');
  assert.equal(modes[0].searchParams.get('mode'), 'getShowVote');
  assert.equal(modes[0].searchParams.get('uuid'), 'show');
  assert.equal(modes[1].searchParams.get('mode'), 'getShowVoteChoice');
  assert.equal(modes[1].searchParams.get('uuid'), 'choice/a');
});
test('getVoter preserves upstream 404 and does not create a replacement voter', async () => {
  let calls = 0;
  const client = createDvLiveClient(config, () => 'N_login', async () => { calls++; return Response.json({ message: 'Voter not found' }, { status: 404 }); });
  await assert.rejects(client.voter(), error => error instanceof DvLiveError && error.status === 404 && error.message === 'Voter not found');
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
test('anonymous or autologin tokens cannot be used as voter references', async () => {
  for (const token of ['', 'A_anonymous', 'U_autologin']) {
    const client = createDvLiveClient(config, () => token, () => { throw new Error('Unexpected request'); });
    assert.throws(() => client.voter(), /Sign in with SmartUser/);
  }
});
