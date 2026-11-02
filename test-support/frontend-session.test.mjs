import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../supabase/functions/_shared/sdk/node_modules/typescript/lib/typescript.js';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const logger = moduleUrl('export function createLogger(){return {debug(){},error(){}}}');
const config = moduleUrl("export const BOLT_AUTH_PROXY_URL='http://edge.test/bolt-auth-proxy'; export const SERVICE_SLUG='dvlive';");
const tracing = moduleUrl('export const traceFetch=(url,options)=>fetch(url,options);');
globalThis.__sessionWrites = [];
const tokenStore = moduleUrl('export async function setAppToken(...args){globalThis.__sessionWrites.push(args)}');
const source = (await readFile(new URL('../frontend/lib/resolveUser.ts', import.meta.url), 'utf8'))
  .replace("'./logger'", JSON.stringify(logger)).replace("'./appConfig'", JSON.stringify(config))
  .replace("'./traceFetch'", JSON.stringify(tracing)).replace("'./supabase'", JSON.stringify(tokenStore));
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { syncSupabaseSession, resolveAbsoluteReference } = await import(moduleUrl(outputText));

test('copied Bravigo frontend deduplicates syncUser and stores the returned JWT', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json({ ok: true, data: { absolute_reference: 'user', user_id: 'user', service_id: 'service', access_token: 'app.jwt', expires_in: 1500 } });
  });
  const [a, b] = await Promise.all([syncSupabaseSession('N_signup'), syncSupabaseSession('N_signup')]);
  assert.equal(calls.length, 1);
  assert.equal(a, b);
  assert.equal(calls[0].url, 'http://edge.test/bolt-auth-proxy');
  assert.deepEqual(JSON.parse(calls[0].options.body), { command: 'syncUser', service_slug: 'dvlive', userToken: 'N_signup' });
  assert.deepEqual(globalThis.__sessionWrites.at(-1), ['app.jwt', 1500]);
});

test('copied Bravigo fetchCurrentUser preserves its command and errors allow retry', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).command, 'fetchCurrentUser');
    return ++calls === 1 ? Response.json({ ok: false, error: { message: 'Unavailable' } })
      : Response.json({ ok: true, data: { absoluteReference: 'user' } });
  });
  await assert.rejects(resolveAbsoluteReference('N_retry'), /Unavailable/);
  assert.equal(await resolveAbsoluteReference('N_retry'), 'user');
});
