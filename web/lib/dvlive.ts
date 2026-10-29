import { getSmartUser } from './smartUser';
import { createDvLiveClient } from './dvliveClient';

export const dvlive = createDvLiveClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  bearer: process.env.EXPO_PUBLIC_DVLIVE_BEARER_TOKEN || '',
  showUuid: process.env.EXPO_PUBLIC_SHOW_VOTE_UUID || '',
}, () => {
  const sdk = getSmartUser();
  if (!sdk.isUserLogged()) throw new Error('Your session has expired. Please sign in again.');
  return sdk.getUserToken();
});
