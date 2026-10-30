import { getSmartUser } from './smartUser';
import Constants from 'expo-constants';
import { createDvLiveClient, type DvLiveConfig } from './dvliveClient';

const config = Constants.expoConfig?.extra?.dvlive as Partial<DvLiveConfig> | undefined;
export const dvlive = createDvLiveClient({
  url: config?.url || '',
  key: config?.key || '',
  bearer: config?.bearer || '',
  showUuid: config?.showUuid || '',
}, () => {
  const sdk = getSmartUser();
  if (!sdk.isUserLogged()) throw new Error('Your session has expired. Please sign in again.');
  return sdk.getUserToken();
});
