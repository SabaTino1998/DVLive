import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './appConfig';

const TOKEN_STORAGE_KEY = '@bolt_app_token';
const EXPIRY_STORAGE_KEY = '@bolt_app_token_expiry';

let inMemoryToken: string | null = null;
let inMemoryExpiry: number | null = null;

export async function setAppToken(token: string, expiresIn: number): Promise<void> {
  const expiryTimestamp = Date.now() + expiresIn * 1000;
  inMemoryToken = token;
  inMemoryExpiry = expiryTimestamp;
  await AsyncStorage.multiSet([
    [TOKEN_STORAGE_KEY, token],
    [EXPIRY_STORAGE_KEY, String(expiryTimestamp)],
  ]);
}

export function getAppToken(): string | null {
  if (inMemoryToken && inMemoryExpiry && Date.now() < inMemoryExpiry) {
    return inMemoryToken;
  }
  return null;
}

export async function loadStoredToken(): Promise<string | null> {
  const values = await AsyncStorage.multiGet([TOKEN_STORAGE_KEY, EXPIRY_STORAGE_KEY]);
  const token = values[0][1];
  const expiry = values[1][1] ? Number(values[1][1]) : 0;
  if (token && Date.now() < expiry) {
    inMemoryToken = token;
    inMemoryExpiry = expiry;
    return token;
  }
  inMemoryToken = null;
  inMemoryExpiry = null;
  return null;
}

export async function clearAppToken(): Promise<void> {
  inMemoryToken = null;
  inMemoryExpiry = null;
  await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, EXPIRY_STORAGE_KEY]);
}

export function getTokenUserId(): string | null {
  const token = getAppToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function getTokenServiceId(): string | null {
  const token = getAppToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.service_id ?? null;
  } catch {
    return null;
  }
}

export function getTokenProductId(): string | null {
  const token = getAppToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.product_id ?? null;
  } catch {
    return null;
  }
}

const authFetch: typeof fetch = (input, init) => {
  const token = getAppToken();
  const bearer = token ?? SUPABASE_ANON_KEY;
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${bearer}`);
  headers.set('apikey', SUPABASE_ANON_KEY);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: authFetch,
  },
});
