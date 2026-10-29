# DVLive — Expo

App React Native con Expo SDK 54 ed Expo Router, come Bravigo. La stessa app gira
su web, iOS e Android. Non usa Vite, Express o cookie di sessione proprietari.

## Avvio web

```bash
cd web
npm install
npm run web
```

Aprire l’indirizzo stampato da Expo, normalmente `http://localhost:8081`.
Se il vecchio server Vite è ancora attivo, interromperlo con Ctrl+C.
`npm run dev` avvia Expo con la scelta della piattaforma; premere `w` per il web.
`npm run ios` e `npm run android` avviano rispettivamente simulatore iOS ed emulatore Android.

Il file locale `.npmrc` configura lo scope privato Digital Virgo per SmartUser ed è escluso da Git.
La configurazione dell’app è in `web/.env`, caricata automaticamente da Expo, senza `export`.
Vedere `.env.example`. Non inserire username e password personali nel bundle:
vengono immessi nel form di login o signup.

Usare una chiave Supabase anon o publishable, mai `sb_secret_` o service-role.
Le variabili `EXPO_PUBLIC_` sono incluse nell’app, compresi App Secret SmartUser e
bearer DV Live usati da questa integrazione di test, come nella configurazione client
di Bravigo. Usare credenziali dedicate a questo ambiente.

Con Supabase locale, dalla root del repository:

```bash
supabase start
supabase functions serve dvlive --env-file supabase/.env
```

Su un dispositivo fisico, `EXPO_PUBLIC_SUPABASE_URL` deve usare l’IP LAN del Mac,
non `127.0.0.1`; sull’emulatore Android il Mac è normalmente raggiungibile da `10.0.2.2`.
Expo può chiedere un runtime compatibile con SDK 54: usare un development build
compatibile se la versione installata di Expo Go supporta solo SDK più recenti.

## SmartUser e flussi

- `lib/smartUser.ts`: singleton `SmartUserRN.getInstance`, adattatore web sul browser,
  AsyncStorage sui dispositivi, HMAC-SHA1 CryptoJS, setup condiviso, autologin e invalidazione.
- `SmartUserProvider`: inizializzazione e aggiornamento tramite gli eventi SDK.
- `AuthProvider`: login email/password e signup email/password nel client, con ripristino
  della sessione gestito da SmartUser. Nessuna copia del token in cookie o storage custom.
- Signup: `signupWithEmail → createVoter → getVoter`, poi saldo e `getShowVote`.
  Come Bravigo, il signup fornisce già il token: non viene eseguito un secondo login.
- Login: `loginWithEmail → getVoter` e `getShowVote`.
- Dettaglio: Expo Router apre `/choices/[uuid]` ed esegue `getShowVoteChoice`.
- `PRESENT` viene visualizzato come **IN THE HOUSE**, `EVICTED` come **EVICTED**.

Tutte le chiamate DV Live passano direttamente dalla Edge Function Supabase.
`userRef`/`uniqRef` usano sempre il token `N_…` corrente dell’SDK.
Un voter non trovato dopo un nuovo login resta un errore esplicito: l’app non crea
automaticamente un altro voter né sostituisce il token con un’identità diversa.
Se `createVoter` fallisce dopo il signup, la home permette di riprovare solo quella
registrazione, senza creare di nuovo l’account SmartUser.

## Verifiche

```bash
npm run typecheck
npm test
npm run build:web
```

I test dei flussi usano risposte simulate e non creano account né voter reali.
