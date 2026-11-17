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
    const client = new DvliveClient({ environment, apiToken: ' api-token ', albToken: ' private-alb-token ' });
    await client.showVotes.get('show/id');
    const [url, options] = capture.mock.calls[0].arguments;
    assert.equal(url.href, `https://${host}/show-vote/show%2Fid`);
    assert.equal(options.headers['X-Internal-Auth'], 'private-alb-token');
    assert.equal(options.headers.Authorization, 'Bearer api-token');
    assert.equal(logs.join('\n').includes('X-Internal-Auth: private-alb-token'), true);
    assert.equal(logs.join('\n').includes('[REDACTED]'), false);
  });
}

test('missing and blank ALB tokens omit only ALB authentication; invalid environments fail before requests', async t => {
  t.mock.method(console, 'log', () => {});
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const albToken of [undefined, '', '   ']) {
    await new DvliveClient({ environment: 'STAG', apiToken: 'api-token', albToken }).showVotes.get('show');
  }
  for (const call of capture.mock.calls) {
    assert.equal(call.arguments[1].headers['X-Internal-Auth'], undefined);
    assert.equal(call.arguments[1].headers.Authorization, 'Bearer api-token');
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
      const local = process.env.DVLIVE_MODE === 'INT';
      assert.equal(url.hostname, (local ? 'int-' : '') + hosts[process.env.DVLIVE_ENV]);
      assert.equal(options.headers['X-Internal-Auth'], local ? undefined : process.env['DVLIVE_ALB_TOKEN_' + process.env.DVLIVE_ENV]);
      assert.equal(options.headers.Authorization, 'Bearer ' + process.env['DVLIVE_API_TOKEN_' + process.env.DVLIVE_ENV].trim());
      return Response.json({name:'Show', startDate:'2026-01-01', endDate:'2026-12-31'});
    };
  `);
  for (const [environment, mode] of ['DEV', 'STAG', 'PROD'].flatMap(environment => ['INT', 'PROD', undefined].map(mode => [environment, mode]))) {
    writeFileSync(join(directory, 'config.json'), JSON.stringify({
      DVLIVE_ENV: 'DEV',
      ...(mode === undefined ? {} : { DVLIVE_MODE: mode === 'INT' ? 'PROD' : 'INT' }),
      showVote: { uuid: 'show' },
    }));
    const result = spawnSync(process.execPath, ['--require', mock, join(directory, 'run.js'), 'getShowVote'], {
      env: { ...process.env, DVLIVE_MODE: mode, DVLIVE_ENV: environment, DVLIVE_API_TOKEN: 'legacy-token', DVLIVE_API_TOKEN_DEV: ' dev-api-token ', DVLIVE_API_TOKEN_STAG: ' stag-api-token ', DVLIVE_API_TOKEN_PROD: ' prod-api-token ', DVLIVE_ALB_TOKEN_DEV: 'dev-cli-token', DVLIVE_ALB_TOKEN_STAG: 'stag-cli-token', DVLIVE_ALB_TOKEN_PROD: 'prod-cli-token' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes(mode === 'INT' ? `Authorization: Bearer ${environment.toLowerCase()}-api-token` : `X-Internal-Auth: ${environment.toLowerCase()}-cli-token`), true);
    assert.equal(result.stdout.includes('[REDACTED]'), false);
  }
});

for (const environment of ['DEV', 'STAG', 'PROD']) {
  for (const mode of ['INT', 'PROD']) {
    test(`${mode}/${environment} selects matching host and bearer and mode-specific ALB authentication`, async t => {
      t.mock.method(console, 'log', () => {});
      const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
      await new DvliveClient({ environment, mode, apiToken: 'api-token', albToken: 'alb-token' }).showVotes.get('show');
      const [url, options] = capture.mock.calls[0].arguments;
      const prefix = environment === 'PROD' ? '' : `${environment.toLowerCase()}-`;
      assert.equal(url.hostname, `${mode === 'INT' ? 'int-' : ''}${prefix}webshow-engine.dv-live.com`);
      assert.equal(options.headers.Authorization, 'Bearer api-token');
      assert.equal(options.headers['X-Internal-Auth'], mode === 'PROD' ? 'alb-token' : undefined);
    });
  }
}

test('invalid access modes fail before requests', () => {
  for (const mode of ['', 'LOCAL', 'int', 'INVALID', null]) {
    assert.throws(() => new DvliveClient({ environment: 'STAG', mode }), /mode must be/);
  }
});

test('both modes require a nonblank API token before requests', () => {
  for (const mode of ['INT', 'PROD', undefined]) {
    for (const apiToken of [undefined, '', '   ']) {
      assert.throws(() => new DvliveClient({ environment: 'STAG', mode, apiToken }), /DVLIVE_API_TOKEN is required/);
    }
  }
});

test('extra request headers cannot override configured authentication or add ALB auth in INT', async t => {
  t.mock.method(console, 'log', () => {});
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const mode of ['INT', 'PROD']) {
    await new DvliveClient({ environment: 'DEV', mode, apiToken: 'api-token', albToken: 'alb-token' })
      .request('GET', '/show-vote/show', { headers: { authorization: 'Bearer other', 'x-internal-auth': 'other', 'X-Test': 'kept' } });
    const headers = new Headers(capture.mock.calls.at(-1).arguments[1].headers);
    assert.equal(headers.get('Authorization'), 'Bearer api-token');
    assert.equal(headers.get('X-Internal-Auth'), mode === 'INT' ? null : 'alb-token');
    assert.equal(headers.get('X-Test'), 'kept');
  }
});

test('CLI selects JSON tokens and rejects missing or blank selected tokens without fallback', t => {
  const { mkdtempSync, writeFileSync, copyFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'dvlive-runner-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ['run.js', 'dvliveClient.js']) copyFileSync(join(__dirname, '..', file), join(directory, file));
  const mock = join(directory, 'fetch.cjs');
  writeFileSync(mock, `global.fetch = async (url, options) => {
    require('node:assert/strict').equal(options.headers.Authorization, 'Bearer json-token');
    return Response.json({name: 'Show'});
  };`);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('DVLIVE_')) delete env[key];
  for (const environment of ['DEV', 'STAG', 'PROD']) {
    for (const mode of ['INT', 'PROD']) {
      const tokenKey = `DVLIVE_API_TOKEN_${environment}`;
      const config = {
        DVLIVE_MODE: mode, DVLIVE_ENV: environment, showVote: { uuid: 'show' },
        DVLIVE_API_TOKEN: 'legacy-token',
        DVLIVE_API_TOKEN_DEV: 'other-token', DVLIVE_API_TOKEN_STAG: 'other-token', DVLIVE_API_TOKEN_PROD: 'other-token',
      };
      for (const token of [' json-token ', undefined, '', '   ']) {
        writeFileSync(join(directory, 'config.json'), JSON.stringify({ ...config, [tokenKey]: token }));
        const result = spawnSync(process.execPath, ['--require', mock, join(directory, 'run.js'), 'getShowVote'], { env, encoding: 'utf8' });
        assert.equal(result.status, token?.trim() ? 0 : 1, result.stderr);
        if (!token?.trim()) assert.ok(result.stderr.includes(`${tokenKey} is required`));
      }
      writeFileSync(join(directory, 'config.json'), JSON.stringify({ ...config, [tokenKey]: 'json-token' }));
      const blankOverride = spawnSync(process.execPath, [join(directory, 'run.js'), 'getShowVote'], { env: { ...env, [tokenKey]: '   ' }, encoding: 'utf8' });
      assert.equal(blankOverride.status, 1);
      assert.ok(blankOverride.stderr.includes(`${tokenKey} is required`));
    }
  }
});

for (const round of [null, { startDay: '2026-11-01', endDay: '2026-11-30', choices: [], name: 'Round' }]) {
  test(`candidate detail composes choice, voter and ${round ? 'round dates' : 'null round'}`, async t => {
    t.mock.method(console, 'log', () => {});
    const choice = { uuid: 'choice/id', showVoteUuid: 'show/id', firstname: 'First', lastname: 'Last', status: 'ACTIVE', order: 1 };
    const balance = { standardPoint: 3, additionalPoint: 2, purchasedPoint: 1 };
    const capture = t.mock.method(globalThis, 'fetch', async url => {
      if (url.pathname === '/show-vote-choice/choice%2Fid') return Response.json(choice);
      if (url.pathname === '/show-vote/show%2Fid/voter/user%2Fref') return Response.json({ balance, remainingPoints: 6 });
      assert.equal(url.pathname, '/show-vote/show%2Fid');
      return Response.json({ round });
    });
    const client = new DvliveClient({ environment: 'STAG', apiToken: 'token' });
    assert.deepEqual(await client.showVoteChoices.get('choice/id', ' user/ref '), {
      ...choice, balance, remainingPoints: 6,
      round: round ? { startDay: round.startDay, endDay: round.endDay } : null,
    });
    assert.equal(capture.mock.callCount(), 3);
  });
}

test('candidate detail requires a voter reference before fetching', async t => {
  const capture = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  const client = new DvliveClient({ environment: 'STAG', apiToken: 'token' });
  for (const userRef of [undefined, '', '   ']) {
    await assert.rejects(client.showVoteChoices.get('choice', userRef), /userRef is required/);
  }
  assert.equal(capture.mock.callCount(), 0);
});

for (const failingPath of ['/show-vote-choice/choice', '/show-vote/show/voter/user', '/show-vote/show']) {
  test(`candidate detail propagates upstream failure from ${failingPath}`, async t => {
    t.mock.method(console, 'log', () => {});
    const capture = t.mock.method(globalThis, 'fetch', async url => {
      if (url.pathname === failingPath) return Response.json({ message: 'Missing resource', code: 404 }, { status: 404 });
      if (url.pathname.startsWith('/show-vote-choice/')) return Response.json({ showVoteUuid: 'show' });
      return Response.json({ balance: {}, remainingPoints: 0, round: null });
    });
    const client = new DvliveClient({ environment: 'STAG', apiToken: 'token' });
    await assert.rejects(client.showVoteChoices.get('choice', 'user'), err => err.statusCode === 404 && err.body.message === 'Missing resource');
    assert.equal(capture.mock.callCount(), failingPath.startsWith('/show-vote-choice/') ? 1 : 3);
  });
}

test('candidate CLI uses configured voter reference and prints enriched fields', t => {
  const { mkdtempSync, writeFileSync, copyFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'dvlive-candidate-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ['run.js', 'dvliveClient.js']) copyFileSync(join(__dirname, '..', file), join(directory, file));
  const mock = join(directory, 'fetch.cjs');
  writeFileSync(mock, `
    const assert = require('node:assert/strict');
    let calls = 0;
    global.fetch = async url => {
      calls++;
      if (url.pathname === '/show-vote-choice/choice') return Response.json({uuid:'choice',showVoteUuid:'actual-show'});
      if (url.pathname === '/show-vote/actual-show/voter/configured-user') return Response.json({balance:{standardPoint:4},remainingPoints:4});
      assert.equal(url.pathname, '/show-vote/actual-show');
      return Response.json({round:{startDay:'start',endDay:'end',name:'hidden'}});
    };
    process.on('exit', () => assert.equal(calls, process.env.EXPECTED_CALLS === '0' ? 0 : 3));
  `);
  for (const userRef of ['configured-user', undefined]) {
    writeFileSync(join(directory, 'config.json'), JSON.stringify({
      DVLIVE_ENV: 'STAG', DVLIVE_API_TOKEN_STAG: 'test-token',
      showVoteChoice: { uuid: 'choice', userRef },
    }));
    const result = spawnSync(process.execPath, ['--require', mock, join(directory, 'run.js'), 'getShowVoteChoice'], {
      env: { ...process.env, DVLIVE_MODE: 'PROD', DVLIVE_ENV: 'STAG', DVLIVE_API_TOKEN_STAG: 'test-token', EXPECTED_CALLS: userRef ? '3' : '0' },
      encoding: 'utf8',
    });
    assert.equal(result.status, userRef ? 0 : 1, result.stderr);
    if (userRef) {
      assert.match(result.stdout, /remainingPoints=4/);
      assert.match(result.stdout, /balance=\{"standardPoint":4\}/);
      assert.match(result.stdout, /round=\{"startDay":"start","endDay":"end"\}/);
    } else {
      assert.match(result.stderr, /Missing required field "showVoteChoice.userRef"/);
    }
  }
});
