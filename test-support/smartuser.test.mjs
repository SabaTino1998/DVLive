import test from 'node:test';
import assert from 'node:assert/strict';
import { getSmartUserToken } from './smartuser.mjs';

const config = {
  applicationId: 'smartuser.test', applicationSecret: 'test-secret', env: 'STAG',
  username: 'test-user', password: 'test-password',
};

function sdk(token = 'N_test-session', setupError, loginError, signupError) {
  const calls = [];
  let options;
  const instance = {
    setup: async (...args) => { calls.push(['setup', ...args]); if (setupError) throw setupError; },
    signupWithEmail: async (...args) => { calls.push(['signup', ...args]); if (signupError) throw signupError; },
    loginWithEmail: async (...args) => { calls.push(['login', ...args]); if (loginError) throw loginError; },
    getUserToken: () => { calls.push(['getToken']); return token; },
    deps: { event: { clearTimers: () => calls.push(['clearTimers']) } },
    _stopContextBearerRefreshTimer: () => calls.push(['stopRefresh']),
  };
  return {
    calls, get options() { return options; },
    load: async () => ({ SmartUserRN: {
      getInstance: input => { options = input; return instance; },
      resetInstance: () => calls.push(['reset']),
    } }),
  };
}

test('setup precedes username/password login and token retrieval and clears process-local storage/timers', async () => {
  const fake = sdk();
  assert.equal(await getSmartUserToken(config, fake.load), 'N_test-session');
  assert.deepEqual(fake.calls, [
    ['setup', 'test-secret', { env: 'STAG' }],
    ['login', 'test-user', 'test-password'], ['getToken'],
    ['clearTimers'], ['stopRefresh'], ['reset'],
  ]);
  assert.deepEqual(await fake.options.AsyncStorage.getAllKeys(), []);
  assert.equal((await fake.options.getHmac('message', 'secret')).length, 40);
  assert.equal(fake.options.getRandomValues(8).length, 8);
});

test('rejects autologin/anonymous tokens and cleans up on failed setup', async () => {
  for (const token of ['U_autologin', 'A_anonymous', '', undefined]) {
    const fake = sdk(token === undefined ? null : token);
    await assert.rejects(getSmartUserToken(config, fake.load), /N_ session token/);
    assert.deepEqual(fake.calls.at(-1), ['reset']);
  }
  const fake = sdk('N_test', new Error('setup failed'));
  await assert.rejects(getSmartUserToken(config, fake.load), /setup failed/);
  assert.deepEqual(fake.calls.at(-1), ['reset']);
});

test('invalid configuration stops before loading SDK or making requests', async () => {
  const load = () => assert.fail('SDK must not load');
  for (const key of ['applicationId', 'applicationSecret', 'username', 'password']) {
    await assert.rejects(getSmartUserToken({ ...config, [key]: '' }, load), /Missing SmartUser configuration/);
  }
  await assert.rejects(getSmartUserToken({ ...config, env: 'TEST' }, load), /STAG or PROD/);
});

test('failed login never returns the setup token and cleans up', async () => {
  const fake = sdk('N_setup-token', undefined, new Error('invalid credentials'));
  await assert.rejects(getSmartUserToken(config, fake.load), /invalid credentials/);
  assert.equal(fake.calls.some(([action]) => action === 'getToken'), false);
  assert.deepEqual(fake.calls.at(-1), ['reset']);
});

test('signup creates email identity after setup, then logs in before returning token', async () => {
  const fake = sdk();
  const signup = { ...config, signup: true, username: 'new@example.test' };
  assert.equal(await getSmartUserToken(signup, fake.load), 'N_test-session');
  assert.deepEqual(fake.calls.slice(0, 4), [
    ['setup', config.applicationSecret, { env: 'STAG' }],
    ['signup', signup.username, config.password],
    ['login', signup.username, config.password], ['getToken'],
  ]);
});

test('signup failure stops before login and cleans up; non-email username is rejected early', async () => {
  const fake = sdk('N_setup-token', undefined, undefined, new Error('user already exists'));
  await assert.rejects(getSmartUserToken({ ...config, signup: true, username: 'existing@example.test' }, fake.load), /user already exists/);
  assert.equal(fake.calls.some(([action]) => action === 'login' || action === 'getToken'), false);
  assert.deepEqual(fake.calls.at(-1), ['reset']);
  await assert.rejects(getSmartUserToken({ ...config, signup: true }, () => assert.fail('SDK must not load')), /email address/);
});
