import { shouldLog, type Logger } from './logger';

const TRACED_PATHS = [
  '/functions/v1/get-product-config',
  '/functions/v1/get-product-document',
  '/functions/v1/smart-journey',
  '/functions/v1/pulsar',
  '/functions/v1/bolt-auth-proxy',
  '/functions/v1/instant-games-assets',
  '/functions/v1/avatar-generate',
];

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'apikey',
  'x-user-token',
  'context-bearer',
]);

function redactHeaderValue(name: string, value: string): string {
  const lower = name.toLowerCase();
  if (!SENSITIVE_HEADERS.has(lower)) return value;

  if (lower === 'authorization') {
    const spaceIdx = value.indexOf(' ');
    if (spaceIdx > 0) {
      const scheme = value.substring(0, spaceIdx + 1);
      const token = value.substring(spaceIdx + 1);
      return scheme + (token.length > 4 ? token.substring(0, 4) + '****' : '****');
    }
  }

  const chars = lower === 'apikey' ? 4 : 6;
  return value.length > chars ? value.substring(0, chars) + '****' : '****';
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      result[k] = redactHeaderValue(k, v);
    }
  } else if (typeof (headers as any).forEach === 'function') {
    (headers as Headers).forEach((v, k) => {
      result[k] = redactHeaderValue(k, v);
    });
  } else {
    for (const [k, v] of Object.entries(headers as Record<string, string>)) {
      result[k] = redactHeaderValue(k, v);
    }
  }
  return result;
}

function redactBodyTokens(bodyStr: string): string {
  try {
    const obj = JSON.parse(bodyStr);
    if (obj && typeof obj.userToken === 'string') {
      const t = obj.userToken;
      obj.userToken = t.length > 6 ? t.substring(0, 6) + '****' : '****';
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return bodyStr;
  }
}

function isTracedUrl(url: string): boolean {
  for (const path of TRACED_PATHS) {
    if (url.includes(path)) return true;
  }
  return false;
}

export async function traceFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  log: Logger,
): Promise<Response> {
  if (!shouldLog('trace')) {
    return fetch(input, init);
  }

  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : (input as Request).url;

  if (!isTracedUrl(url)) {
    return fetch(input, init);
  }

  const method = init?.method?.toUpperCase() || 'GET';
  const t = '[NET-TRACE]';
  const start = Date.now();

  log.trace(`${t} --> ${method} ${url}`);

  const redactedHeaders = normalizeHeaders(init?.headers);
  if (Object.keys(redactedHeaders).length > 0) {
    log.trace(`${t}     Headers:`, redactedHeaders);
  }

  if (init?.body && typeof init.body === 'string') {
    log.trace(`${t}     Body:`, redactBodyTokens(init.body));
  }

  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    log.trace(`${t} <-- NETWORK ERROR: ${msg} (${elapsed}ms)`);
    throw err;
  }

  const elapsed = Date.now() - start;
  log.trace(`${t} <-- ${response.status} ${response.statusText} (${elapsed}ms)`);

  try {
    const clone = response.clone();
    const bodyText = await clone.text();
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        log.trace(`${t}     Body:`, JSON.stringify(parsed, null, 2));
      } catch {
        log.trace(`${t}     Body:`, bodyText);
      }
    }
  } catch {
    log.trace(`${t}     Body: [unable to read response body]`);
  }

  return response;
}
