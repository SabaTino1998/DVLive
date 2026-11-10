import Constants from 'expo-constants';

// Local configuration adapter; auth/session modules are copied from Bravigo.
const config = Constants.expoConfig?.extra?.dvlive;
export const SUPABASE_URL: string = config?.url || '';
export const SUPABASE_ANON_KEY: string = config?.key || '';
export const SERVICE_SLUG = process.env.EXPO_PUBLIC_SERVICE_SLUG || 'dvlive';
export const BOLT_AUTH_PROXY_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/bolt-auth-proxy`;
