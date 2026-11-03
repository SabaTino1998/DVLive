import type { ChoiceDetail, Show, Voter } from '../src/types';

export interface DvLiveConfig { url: string; key: string; showUuid: string }
export interface CastVoteBody {
  votes: { choiceUuid: string; nbVotes: number }[];
  sessionToken?: string;
  phoneFingerPrint?: string;
  ip?: string;
  userAgent?: string;
  uniqSubscriptionId?: string;
}
export class DvLiveError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: unknown;
  constructor(message: string, status: number, code?: string, details: unknown = null) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
export function createDvLiveClient(config: DvLiveConfig, token: (force?: boolean) => string | Promise<string>, send: typeof fetch = fetch) {
  async function request<T>(mode: string, params: Record<string, string>, body?: object): Promise<T> {
    if (!config.url || !config.key || !config.showUuid) {
      throw new Error('Complete the Supabase and DV Live configuration in frontend/.env.');
    }
    if (config.key.startsWith('sb_secret_')) throw new Error('Use a Supabase anon or publishable key instead of a secret key.');
    async function authorization(force?: boolean) {
      const jwt = (await token(force)).trim();
      if (!jwt) throw new DvLiveError('Your app session has expired. Please sign in again.', 401, 'AUTH_REQUIRED');
      return `Bearer ${jwt}`;
    }
    const headers: Record<string, string> = { Accept: 'application/json', apikey: config.key, Authorization: await authorization() };
    if (body) headers['Content-Type'] = 'application/json';
    const endpoint = `${config.url.replace(/\/$/, '')}/functions/v1/dvlive?${new URLSearchParams({ mode, ...params })}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const options = { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal };
      let response = await send(endpoint, options);
      if (response.status === 401) {
        headers.Authorization = await authorization(true);
        response = await send(endpoint, options);
      }
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        throw new DvLiveError(result?.error?.message || `DV Live returned error ${response.status}.`, response.status, result?.error?.code, result?.error?.details);
      }
      if (result?.ok !== true || !Object.hasOwn(result, 'data')) throw new DvLiveError('Invalid DV Live response.', 502);
      return result.data as T;
    } finally { clearTimeout(timer); }
  }
  return {
    createVoter: (email?: string) => request('createVoter', { showVoteUuid: config.showUuid }, { ...(email ? { email } : {}) }),
    voter: () => request<Voter>('getVoter', { showVoteUuid: config.showUuid }),
    show: () => request<Show>('getShowVote', { uuid: config.showUuid }),
    choice: (uuid: string) => request<ChoiceDetail>('getShowVoteChoice', { uuid }),
    castVote: (body: CastVoteBody) => request<unknown>('castVote', { showVoteUuid: config.showUuid }, {
      votes: body.votes.map(({ choiceUuid, nbVotes }) => ({ choiceUuid, nbVotes })),
      sessionToken: body.sessionToken, phoneFingerPrint: body.phoneFingerPrint,
      ip: body.ip, userAgent: body.userAgent, uniqSubscriptionId: body.uniqSubscriptionId,
    }),
  };
}
