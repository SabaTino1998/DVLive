import { getSmartUser } from './smartUser';
import Constants from 'expo-constants';
import { createDvLiveClient, type DvLiveConfig } from './dvliveClient';
import { syncSupabaseSession } from './resolveUser';
import { getAppToken } from './supabase';

const config = Constants.expoConfig?.extra?.dvlive as Partial<DvLiveConfig> | undefined;
export const dvlive = createDvLiveClient({
  url: config?.url || '',
  key: config?.key || '',
  bearer: config?.bearer || '',
  showUuid: config?.showUuid || '',
}, async force => {
  const sdk = getSmartUser();
  if (!sdk.isUserLogged()) throw new Error('Your session has expired. Please sign in again.');
  if (force || !getAppToken()) await syncSupabaseSession(sdk.getUserToken());
  const token = getAppToken();
  if (!token) throw new Error('Your app session has expired. Please sign in again.');
  return token;
});
