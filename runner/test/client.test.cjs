const test = require('node:test');
const assert = require('node:assert/strict');
const { DvliveClient } = require('../dvliveClient.js');

for (const [environment, host] of [
  ['DEV', 'dev-webshow-engine.dv-live.com'],
  ['STAG', 'stag-webshow-engine.dv-live.com'],
  ['PROD', 'webshow-engine.dv-live.com'],
]) {
  test(`${environment} uses its external host and ALB header and prints the actual token in the curl command`, async t => {
    const logs = [];
    t.mock.method(console, 'log', message => logs.push(message));
    const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({ name: 'Show' }));
    const client = new DvliveClient({ environment, albToken: ' private-alb-token ' });
    await client.showVotes.get('show/id');
    const [url, options] = capture.mock.calls[0].arguments;
    assert.equal(url.href, `https://${host}/show-vote/show%2Fid`);
    assert.equal(options.headers['X-Internal-Auth'], 'private-alb-token');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(logs.join('\n').includes('X-Internal-Auth: private-alb-token'), true);
    assert.equal(logs.join('\n').includes('[REDACTED]'), false);
  });
}

test('missing and blank tokens omit authentication; invalid environments fail before requests', async t => {
  t.mock.method(console, 'log', () => {});
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const albToken of [undefined, '', '   ']) {
    await new DvliveClient({ environment: 'STAG', albToken }).showVotes.get('show');
  }
  for (const call of capture.mock.calls) {
    assert.equal(call.arguments[1].headers['X-Internal-Auth'], undefined);
    assert.equal(call.arguments[1].headers.Authorization, undefined);
  }
  for (const environment of [undefined, 'stag', 'constructor', '__proto__']) {
    assert.throws(() => new DvliveClient({ environment }), /environment must be/);
  }
  assert.equal(capture.mock.callCount(), 3);
});

test('CLI selects the environment token and URL from environment overrides', t => {
  const { mkdtempSync, writeFileSync, copyFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'dvlive-runner-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ['run.js', 'dvliveClient.js']) copyFileSync(join(__dirname, '..', file), join(directory, file));
  const mock = join(directory, 'fetch.cjs');
  writeFileSync(mock, `
    const assert = require('node:assert/strict');
    global.fetch = async (url, options) => {
      const hosts = {DEV:'dev-webshow-engine.dv-live.com', STAG:'stag-webshow-engine.dv-live.com', PROD:'webshow-engine.dv-live.com'};
      const local = process.env.DVLIVE_MODE === 'LOCAL';
      assert.equal(url.hostname, (local ? 'int-' : '') + hosts[process.env.DVLIVE_ENV]);
      assert.equal(options.headers['X-Internal-Auth'], local ? undefined : process.env['DVLIVE_ALB_TOKEN_' + process.env.DVLIVE_ENV]);
      assert.equal(options.headers.Authorization, local ? 'Bearer dev-auth-token' : undefined);
      return Response.json({name:'Show', startDate:'2026-01-01', endDate:'2026-12-31'});
    };
  `);
  for (const [environment, mode] of ['DEV', 'STAG', 'PROD'].flatMap(environment => ['LOCAL', 'PROD', undefined].map(mode => [environment, mode]))) {
    writeFileSync(join(directory, 'config.json'), JSON.stringify({
      DVLIVE_ENV: 'DEV',
      ...(mode === undefined ? {} : { DVLIVE_MODE: mode === 'LOCAL' ? 'PROD' : 'LOCAL' }),
      showVote: { uuid: 'show' },
    }));
    const result = spawnSync(process.execPath, ['--require', mock, join(directory, 'run.js'), 'getShowVote'], {
      env: { ...process.env, DVLIVE_MODE: mode, DVLIVE_ENV: environment, DVLIVE_ALB_TOKEN_DEV: 'dev-cli-token', DVLIVE_ALB_TOKEN_STAG: 'stag-cli-token', DVLIVE_ALB_TOKEN_PROD: 'prod-cli-token' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes(mode === 'LOCAL' ? 'Authorization: Bearer dev-auth-token' : `X-Internal-Auth: ${environment.toLowerCase()}-cli-token`), true);
    assert.equal(result.stdout.includes('[REDACTED]'), false);
  }
});

for (const environment of ['DEV', 'STAG', 'PROD']) {
  for (const mode of ['LOCAL', 'PROD']) {
    test(`${mode}/${environment} selects matching host and exclusive authentication`, async t => {
      t.mock.method(console, 'log', () => {});
      const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
      await new DvliveClient({ environment, mode, albToken: 'alb-token' }).showVotes.get('show');
      const [url, options] = capture.mock.calls[0].arguments;
      const prefix = environment === 'PROD' ? '' : `${environment.toLowerCase()}-`;
      assert.equal(url.hostname, `${mode === 'LOCAL' ? 'int-' : ''}${prefix}webshow-engine.dv-live.com`);
      assert.equal(options.headers.Authorization, mode === 'LOCAL' ? 'Bearer dev-auth-token' : undefined);
      assert.equal(options.headers['X-Internal-Auth'], mode === 'PROD' ? 'alb-token' : undefined);
    });
  }
}

test('invalid access modes fail before requests', () => {
  for (const mode of ['', 'local', 'INVALID', null]) {
    assert.throws(() => new DvliveClient({ environment: 'STAG', mode }), /mode must be/);
  }
});
