import type { ChoiceDetail, Show, Voter } from '../src/types';

export interface DvLiveConfig { url: string; key: string; bearer: string; showUuid: string }
export class DvLiveError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export function createDvLiveClient(config: DvLiveConfig, token: (force?: boolean) => string | Promise<string>, send: typeof fetch = fetch) {
  async function request<T>(mode: string, params: Record<string, string>, body?: object): Promise<T> {
    if (!config.url || !config.key || !config.bearer || !config.showUuid) {
      throw new Error('Complete the Supabase and DV Live configuration in frontend/.env.');
    }
    if (config.key.startsWith('sb_secret_')) throw new Error('Use a Supabase anon or publishable key instead of a secret key.');
    const headers: Record<string, string> = { Accept: 'application/json', apikey: config.key, 'bearer-token': config.bearer };
    // Legacy anon JWTs work with gateway JWT verification. Publishable keys are not JWTs.
    if (config.key.startsWith('eyJ')) headers.Authorization = `Bearer ${config.key}`;
    const needsUser = ['getVoter', 'createVoter', 'castVote'].includes(mode);
    if (needsUser) headers.Authorization = `Bearer ${await token()}`;
    if (body) headers['Content-Type'] = 'application/json';
    const endpoint = `${config.url.replace(/\/$/, '')}/functions/v1/dvlive?${new URLSearchParams({ mode, ...params })}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const options = { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal };
      let response = await send(endpoint, options);
      if (needsUser && response.status === 401) {
        headers.Authorization = `Bearer ${await token(true)}`;
        response = await send(endpoint, options);
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new DvLiveError(data?.message || `DV Live returned error ${response.status}.`, response.status);
      if (!data || typeof data !== 'object') throw new DvLiveError('Invalid DV Live response.', 502);
      return data as T;
    } finally { clearTimeout(timer); }
  }
  return {
    createVoter: (email?: string) => request('createVoter', { showVoteUuid: config.showUuid }, { ...(email ? { email } : {}) }),
    voter: () => request<Voter>('getVoter', { showVoteUuid: config.showUuid }),
    show: () => request<Show>('getShowVote', { uuid: config.showUuid }),
    choice: (uuid: string) => request<ChoiceDetail>('getShowVoteChoice', { uuid }),
  };
}
