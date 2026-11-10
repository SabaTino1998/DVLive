import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSmartUser, onSmartUserInvalidated, setupSmartUser } from '../lib/smartUser';

interface State { ready: boolean; error: string | null; userToken: string | null; isLogged: boolean }
const initial: State = { ready: false, error: null, userToken: null, isLogged: false };
const Context = createContext<State & { refresh: () => Promise<void> }>({ ...initial, refresh: async () => {} });

export function SmartUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  const read = useCallback(() => {
    const sdk = getSmartUser();
    const isLogged = sdk.isUserLogged();
    setState({ ready: true, error: null, isLogged, userToken: isLogged ? sdk.getUserToken() : null });
  }, []);
  const refresh = useCallback(async () => {
    try { await setupSmartUser(); read(); }
    catch (error) { setState({ ...initial, ready: true, error: error instanceof Error ? error.message : 'SmartUser is unavailable.' }); }
  }, [read]);
  useEffect(() => {
    let mounted = true;
    let remove = () => {};
    const invalidated = onSmartUserInvalidated(() => {
      if (mounted) setState({ ready: true, error: null, isLogged: false, userToken: null });
    });
    setupSmartUser().then(sdk => {
      if (!mounted) return;
      read();
      sdk.on('user-status-did-change', read);
      remove = () => sdk.removeListener('user-status-did-change', read);
    }).catch(error => {
      if (mounted) setState({ ...initial, ready: true, error: error instanceof Error ? error.message : 'SmartUser is unavailable.' });
    });
    return () => { mounted = false; remove(); invalidated(); };
  }, [read]);
  return <Context.Provider value={{ ...state, refresh }}>{children}</Context.Provider>;
}
export const useSmartUser = () => useContext(Context);
