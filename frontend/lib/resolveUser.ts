import { createLogger } from './logger';
import { BOLT_AUTH_PROXY_URL, SERVICE_SLUG } from './appConfig';
import { traceFetch } from './traceFetch';
import { setAppToken } from './supabase';

const log = createLogger('AUTH');

interface FetchCurrentUserResponse {
  ok: boolean;
  data?: { absoluteReference: string | null };
  error?: { message: string; code?: string };
}

export interface SyncUserResult {
  absolute_reference: string;
  user_id: string;
  service_id: string;
  access_token: string;
  expires_in: number;
}

interface SyncUserResponse {
  ok: boolean;
  data?: SyncUserResult;
  error?: { message: string; code?: string };
}

const inFlight = new Map<string, Promise<string>>();

export function resolveAbsoluteReference(sessionToken: string): Promise<string> {
  const existing = inFlight.get(sessionToken);
  if (existing) {
    log.debug('Returning in-flight promise for token (dedup)');
    return existing;
  }

  const promise = _resolveAbsoluteReference(sessionToken).finally(() => {
    inFlight.delete(sessionToken);
  });

  inFlight.set(sessionToken, promise);
  return promise;
}

async function _resolveAbsoluteReference(sessionToken: string): Promise<string> {
  log.debug('Resolving absolute reference via Edge Function');

  const response = await traceFetch(BOLT_AUTH_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'fetchCurrentUser',
      service_slug: SERVICE_SLUG,
      userToken: sessionToken,
    }),
  }, log);

  const result: FetchCurrentUserResponse = await response.json();

  if (!result.ok || !result.data?.absoluteReference) {
    const errorMsg = result.error?.message ?? 'Failed to resolve user';
    log.error('fetchCurrentUser failed:', errorMsg);
    throw new Error(errorMsg);
  }

  log.debug('Resolved absolute reference:', result.data.absoluteReference);
  return result.data.absoluteReference;
}

const syncInFlight = new Map<string, Promise<SyncUserResult>>();

export function syncSupabaseSession(sessionToken: string): Promise<SyncUserResult> {
  const existing = syncInFlight.get(sessionToken);
  if (existing) {
    log.debug('Returning in-flight syncUser promise (dedup)');
    return existing;
  }

  const promise = _syncSupabaseSession(sessionToken).finally(() => {
    syncInFlight.delete(sessionToken);
  });

  syncInFlight.set(sessionToken, promise);
  return promise;
}

async function _syncSupabaseSession(sessionToken: string): Promise<SyncUserResult> {
  log.debug('Syncing session via bolt-auth-proxy');

  const response = await traceFetch(BOLT_AUTH_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'syncUser',
      service_slug: SERVICE_SLUG,
      userToken: sessionToken,
    }),
  }, log);

  const result: SyncUserResponse = await response.json();

  if (!result.ok || !result.data) {
    const errorMsg = result.error?.message ?? 'Failed to sync user session';
    log.error('syncUser failed:', errorMsg);
    throw new Error(errorMsg);
  }

  await setAppToken(result.data.access_token, result.data.expires_in);

  log.debug('syncUser succeeded, user_id:', result.data.user_id);
  return result.data;
}
