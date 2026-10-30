import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'dvlive-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // Deliberately fake credentials: these tests never contact SmartUser.
  // The special characters exercise JSON-to-shell parsing, not authentication.
  const settings = {
    EXPO_PUBLIC_SMARTUSER_APP_ID: 'test.bolt.app',
    EXPO_PUBLIC_SMARTUSER_SECRET: "special'\"$()<>|\\secret\n",
    EXPO_PUBLIC_SMARTUSER_ENV: 'STAG', SMART_USER_USERNAME: 'test@example.test',
    SMART_USER_PASSWORD: '123456', DVLIVE_BEARER_TOKEN: 'test-bearer', SHOW_VOTE_UUID: 'json-show/a',
    SUPABASE_URL: 'http://supabase.test', SUPABASE_ANON_KEY: 'test-key',
  };
  const config = join(directory, 'config.json');
  writeFileSync(config, JSON.stringify(settings));
  const environment = { ...process.env, SMOKE_CONFIG_FILE: config, CAPTURE: join(directory, 'capture.json'), PATH: `${directory}:${process.env.PATH}` };
  for (const key of Object.keys(settings)) delete environment[key];
  return { directory, settings, config, environment };
}
test('SmartUser smokes load JSON and preserve credentials without exporting them', t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'node'), `#!/usr/bin/env python3
import sys,json,os
data=json.load(open(os.environ['SMOKE_CONFIG_FILE']))
keys=['EXPO_PUBLIC_SMARTUSER_APP_ID','EXPO_PUBLIC_SMARTUSER_SECRET','EXPO_PUBLIC_SMARTUSER_ENV','SMART_USER_USERNAME','SMART_USER_PASSWORD']
assert sys.stdin.buffer.read().decode().split('\\0')[:-1]==[data[key] for key in keys]
assert not any(key in os.environ for key in keys)
print('N_mock-session')
`, { mode: 0o755 });
  for (const name of ['smoke-smartuser-token.sh', 'smoke-smartuser-signup.sh']) {
    const result = spawnSync('bash', [name], { cwd: join(root, 'script'), env: f.environment, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'N_mock-session');
  }
});
test('show smoke and direct add-vote share JSON bearer and show UUID', t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'curl'), `#!/usr/bin/env python3
import sys,json,os
a=sys.argv[1:]
open(os.environ['CAPTURE'],'w').write(json.dumps(a))
post='POST' in a
data={'status':'success','code':201,'message':'Recorded'} if post else {'name':'Show','startDate':'start','endDate':'end','round':None}
open(a[a.index('--output')+1],'w').write(json.dumps(data))
print('201' if post else '200',end='')
`, { mode: 0o755 });
  for (const name of ['smoke-get-show-vote.sh', 'smoke-add-vote.sh']) {
    const result = spawnSync('bash', [name], { cwd: join(root, 'script'), env: { ...f.environment, USER_REF: 'N_manual-token' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(readFileSync(f.environment.CAPTURE, 'utf8'));
    if (name.includes('add-vote')) {
      assert.ok(args.includes('Authorization: Bearer test-bearer'));
      assert.match(args.at(-1), /show-vote\/json-show%2Fa\/voter\/N_manual-token\/add-vote$/);
      assert.ok(!args.includes('apikey: test-key'));
    } else {
      assert.ok(args.includes('bearer-token: test-bearer'));
      assert.equal(new URL(args.at(-1)).searchParams.get('uuid'), f.settings.SHOW_VOTE_UUID);
    }
  }
});
test('loader rejects invalid JSON and ignores unknown shell variable names', t => {
  const f = fixture(t);
  writeFileSync(f.config, '{invalid');
  let result = spawnSync('bash', ['script/smoke-smartuser-token.sh'], { cwd: root, env: f.environment, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JSON object/);
  writeFileSync(f.config, JSON.stringify({ ...f.settings, HOME: '/should-not-change' }));
  result = spawnSync('bash', ['-c', 'source script/smoke-config.sh; printf "%s" "$HOME"'], { cwd: root, env: f.environment, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(result.stdout, '/should-not-change');
});
