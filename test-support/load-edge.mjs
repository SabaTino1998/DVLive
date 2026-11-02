import { readFile } from 'node:fs/promises';
import ts from '../supabase/functions/_shared/sdk/node_modules/typescript/lib/typescript.js';

const cache = new Map();
export async function edgeModule(relative) {
  const url = new URL(relative, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  let source = await readFile(url, 'utf8');
  source = source.replace(/^import "jsr:@supabase\/functions-js\/edge-runtime\.d\.ts";\n/m, '');
  if (url.pathname.endsWith('/dvlive/index.ts')) source = source.slice(0, source.indexOf('export const handleRequest'));
  for (const match of [...source.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)]) {
    const name = match[1];
    const target = name.startsWith('.') ? await edgeModule(new URL(name, url).href)
      : name === '@digitalvirgo/dvlive-api' ? new URL('../supabase/functions/_shared/sdk/dist/index.js', import.meta.url).href
      : name === 'jsr:@zaubrik/djwt@3.0.2' ? import.meta.resolve('@jsr/zaubrik__djwt')
      : import.meta.resolve(name.replace(/^npm:/, '').replace(/(@[^/@]+)$/, ''));
    source = source.replace(match[0], match[0].replace(/["'][^"']+["']$/, JSON.stringify(target)));
  }
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  cache.set(url.href, moduleUrl);
  return moduleUrl;
}
