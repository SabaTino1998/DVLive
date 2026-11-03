# DVLive — Expo

App React Native con Expo SDK 54 ed Expo Router, come Bravigo. La stessa app gira
su web, iOS e Android. Non usa Vite, Express o cookie di sessione proprietari.

## Avvio web

```bash
cd frontend
npm install
npm run web
```

Aprire l’indirizzo stampato da Expo, normalmente `http://localhost:8081`.
Se il vecchio server Vite è ancora attivo, interromperlo con Ctrl+C.
`npm run dev` avvia Expo con la scelta della piattaforma; premere `w` per il web.
`npm run ios` e `npm run android` avviano rispettivamente simulatore iOS ed emulatore Android.

Il file locale `.npmrc` configura lo scope privato Digital Virgo per SmartUser ed è escluso da Git.
La configurazione dell’app è in `frontend/.env`, caricata automaticamente da Expo, senza `export`.
Vedere `.env.example`. Non inserire username e password personali nel bundle:
vengono immessi nel form di login o signup.

Usare una chiave Supabase anon o publishable, mai `sb_secret_` o service-role.
Le variabili `EXPO_PUBLIC_` sono incluse nell’app, compreso App Secret SmartUser,
come nella configurazione client di Bravigo. Usare credenziali dedicate a questo ambiente.
Il token DV Live è configurato esclusivamente nel backend BBM come secret
`DVLIVE_API_TOKEN`; non impostare `DVLIVE_BEARER_TOKEN` o
`EXPO_PUBLIC_DVLIVE_BEARER_TOKEN` nell’app.

Il client richiede la Edge Function del pack `packs/bbm` con il nuovo contratto
`{ ok, data }` / `{ ok: false, error }`. Impostare `SUPABASE_URL` su quel backend.
La funzione e gli smoke script di questo repository implementano lo stesso contratto.

Per avviare il backend locale, configurare `DVLIVE_API_TOKEN` in `supabase/.env`
e dalla root del repository eseguire:

```bash
supabase start
supabase functions serve --env-file supabase/.env
```

Su un dispositivo fisico, `SUPABASE_URL` deve usare l’IP LAN del Mac,
non `127.0.0.1`; sull’emulatore Android il Mac è normalmente raggiungibile da `10.0.2.2`.
Expo può chiedere un runtime compatibile con SDK 54: usare un development build
compatibile se la versione installata di Expo Go supporta solo SDK più recenti.

## SmartUser e flussi

- `lib/smartUser.ts`: singleton `SmartUserRN.getInstance`, adattatore web sul browser,
  AsyncStorage sui dispositivi, HMAC-SHA1 CryptoJS, setup condiviso, autologin e invalidazione.
- `SmartUserProvider`: inizializzazione e aggiornamento tramite gli eventi SDK.
- `AuthProvider`: login email/password e signup email/password nel client, con ripristino
  della sessione gestito da SmartUser. Nessuna copia del token in cookie o storage custom.
- Signup: `signupWithEmail → syncSupabaseSession → createVoter → getVoter`, poi saldo e `getShowVote`.
  Come Bravigo, il signup fornisce già il token: non viene eseguito un secondo login.
- Login: `loginWithEmail → syncSupabaseSession → getVoter` e `getShowVote`.
- Dettaglio: Expo Router apre `/choices/[uuid]` ed esegue `getShowVoteChoice`.
- `PRESENT` viene visualizzato come **PRESENT**, `EVICTED` come **EVICTED**.

Tutte le chiamate DV Live passano direttamente dalla Edge Function Supabase.
`resolveUser.ts` e `supabase.ts` sono quelli originali di Bravigo: `syncUser`
restituisce il JWT applicativo, persistito con scadenza tramite `setAppToken`.
Il client DVLive invia quel JWT in `Authorization: Bearer <access_token>` per tutti
i cinque comandi, insieme ad `apikey`. Non invia `bearer-token`. La edge BBM ricava
`userRef` e `uniqRef` dal claim `absolute_reference`, piatto o in `app_metadata`;
`sub` è l’UUID del profilo interno. Non vengono inviati riferimenti utente dal client.
Il client restituisce `data` dopo aver verificato `ok: true`; gli errori espongono
`message`, `code`, `details` e lo status HTTP tramite `DvLiveError`.
`castVote` è disponibile nel client con `votes` e i campi antifrode opzionali;
l’interfaccia attuale mostra soltanto saldo e dettagli.
Alla scadenza, o dopo un 401, il client rinnova il JWT con `syncSupabaseSession`.
`EXPO_PUBLIC_SERVICE_SLUG=dvlive` seleziona servizio e credenziali backend.
Signup salva lo stato di registrazione voter pendente prima di `syncUser`, per
consentire un nuovo tentativo senza ricreare l’account SmartUser.
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

## Interfaccia

Interfaccia essenziale in inglese con terminologia DVLive: round, choices e choice.
Il saldo `remainingPoints` è presentato come **Available votes**; `standardPoint`,
`additionalPoint` e `purchasedPoint` come Standard, Additional e Purchased votes.
I nomi dei campi API restano invariati.

La configurazione DV Live usa i nomi originali `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SHOW_VOTE_UUID`, senza alias
`EXPO_PUBLIC_` duplicati. `app.config.ts` li seleziona nel campo `extra.dvlive`
e il client li legge tramite Expo Constants. Questi valori restano visibili
nella configurazione pubblica dell’app; cambiare il nome non li rende segreti.
Riavviare Expo dopo le modifiche a queste variabili.
