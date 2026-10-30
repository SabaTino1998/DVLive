import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticate } from '../lib/authFlow';
import { getApplicationId, getSmartUser, setupSmartUser } from '../lib/smartUser';
import { useSmartUser } from './SmartUserContext';

export interface Session { email: string; userToken: string; needsRegistration: boolean }
interface Auth {
  session: Session | null; restoring: boolean; busy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>; voterRegistered: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
const metadataKey = () => `dvlive-profile:${getApplicationId()}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const smartUser = useSmartUser();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true); const [busy, setBusy] = useState(false);
  const manual = useRef(false);
  useEffect(() => {
    if (!smartUser.ready) return;
    if (manual.current) { setRestoring(false); return; }
    if (!smartUser.isLogged || !smartUser.userToken?.startsWith('N_')) { setSession(null); setRestoring(false); return; }
    let current = true;
    const token = smartUser.userToken;
    AsyncStorage.getItem(metadataKey()).then(raw => {
      let metadata: { email?: string; needsRegistration?: boolean } = {};
      try { metadata = raw ? JSON.parse(raw) : {}; } catch { /* Recover without optional metadata. */ }
      if (current) setSession(previous => previous?.userToken === token ? previous : { email: metadata.email || '', userToken: token, needsRegistration: metadata.needsRegistration === true });
    }).catch(() => { if (current) setSession({ email: '', userToken: token, needsRegistration: false }); }).finally(() => { if (current) setRestoring(false); });
    return () => { current = false; };
  }, [smartUser.ready, smartUser.isLogged, smartUser.userToken]);

  const login = useCallback(async (signup: boolean, email: string, password: string) => {
    if (manual.current) return;
    manual.current = true; setBusy(true);
    try {
      const sdk = await setupSmartUser();
      const value = await authenticate(sdk, signup, email.trim(), password);
      // Store only UI metadata; SmartUser owns all token persistence and refresh.
      await AsyncStorage.setItem(metadataKey(), JSON.stringify({ email: value.email, needsRegistration: value.needsRegistration }));
      setSession(value);
    } finally { manual.current = false; setBusy(false); await smartUser.refresh(); }
  }, [smartUser.refresh]);
  const signOut = useCallback(async () => {
    manual.current = true; setBusy(true);
    try { await getSmartUser().logout(); await AsyncStorage.removeItem(metadataKey()); setSession(null); }
    finally { manual.current = false; setBusy(false); await smartUser.refresh(); }
  }, [smartUser.refresh]);
  const voterRegistered = useCallback(async () => {
    if (!session) return;
    await AsyncStorage.setItem(metadataKey(), JSON.stringify({ email: session.email, needsRegistration: false }));
    setSession(previous => previous ? { ...previous, needsRegistration: false } : previous);
  }, [session]);
  return <Context.Provider value={{ session, restoring, busy, signIn: (email, password) => login(false, email, password), signUp: (email, password) => login(true, email, password), signOut, voterRegistered }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing.');
  return value;
}
