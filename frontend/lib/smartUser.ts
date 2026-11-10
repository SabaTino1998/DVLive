import { Dimensions, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { SmartUserRN, type SetupOptions } from '@digitalvirgo/su-bolt-react';
import CryptoJS from 'crypto-js';

let instance: SmartUserRN | null = null;
let setupPromise: Promise<SmartUserRN> | null = null;
let complete = false;
const invalidationListeners = new Set<() => void>();

export function getApplicationId() {
  const configured = process.env.EXPO_PUBLIC_SMARTUSER_APP_ID;
  if (configured && configured.toUpperCase() !== 'AUTO') return configured;
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : 'smartuser.test';
}
async function createInstance() {
  if (instance) return instance;
  const common = {
    applicationId: getApplicationId(),
    getHmac: async (message: string, secret: string) => CryptoJS.HmacSHA1(message, secret).toString(CryptoJS.enc.Hex),
    debug: process.env.EXPO_PUBLIC_LOG_SMARTUSER === 'true',
    fetch,
  };
  if (Platform.OS === 'web') {
    const { createWebSmartUserAsyncStorage, getWebPlatformConfig } = await import('@digitalvirgo/su-bolt-react/web-adapter');
    const platform = getWebPlatformConfig();
    instance = SmartUserRN.getInstance({
      ...common, AsyncStorage: createWebSmartUserAsyncStorage(),
      Dimensions: platform.Dimensions, Platform: platform.Platform,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
  } else {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    instance = SmartUserRN.getInstance({ ...common, AsyncStorage, Dimensions, Platform: { ...Platform } });
  }
  instance.on('did-invalidate', () => {
    complete = false; setupPromise = null;
    invalidationListeners.forEach(listener => listener());
  });
  return instance;
}

// Same lifecycle as Bravigo: singleton, shared setup promise, platform storage,
// optional autologin, and reinitialization after SDK invalidation.
export function setupSmartUser(): Promise<SmartUserRN> {
  if (complete && instance) return Promise.resolve(instance);
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    const sdk = await createInstance();
    const secret = process.env.EXPO_PUBLIC_SMARTUSER_SECRET;
    if (!secret || secret === '<secret>') throw new Error('Set EXPO_PUBLIC_SMARTUSER_SECRET in frontend/.env.');
    const env = process.env.EXPO_PUBLIC_SMARTUSER_ENV || 'PROD';
    if (env !== 'STAG' && env !== 'PROD') throw new Error('The SmartUser environment must be STAG or PROD.');
    const opts: SetupOptions = { env };
    if (process.env.EXPO_PUBLIC_SMART_USER_COUNTRY) opts.country = process.env.EXPO_PUBLIC_SMART_USER_COUNTRY;
    if (process.env.EXPO_PUBLIC_SMART_USER_DISTRIBUTION_GROUP) opts.distributionGroup = process.env.EXPO_PUBLIC_SMART_USER_DISTRIBUTION_GROUP;
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : await Linking.getInitialURL();
    const params = url ? Linking.parse(url).queryParams : null;
    const parameter = (name: string) => typeof params?.[name] === 'string' ? params[name] as string : undefined;
    try { await sdk.setup(secret, opts, parameter('operationId'), parameter('authtoken'), parameter('identificationId')); }
    catch (error) { if (!(error instanceof Error) || !error.message.includes('Credentials already set')) throw error; }
    if (parameter('_bet')) await sdk.handleLoginReturn(parameter('_bet')!);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const clean = new URL(window.location.href);
      for (const key of ['operationId', 'authtoken', 'identificationId', '_bet']) clean.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', clean.toString());
    }
    complete = true;
    return sdk;
  })().catch(error => { setupPromise = null; throw error; });
  return setupPromise;
}
export function getSmartUser(): SmartUserRN {
  if (!instance) throw new Error('SmartUser has not been initialized yet.');
  return instance;
}
export function onSmartUserInvalidated(listener: () => void) {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}
