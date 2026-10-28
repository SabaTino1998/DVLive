# DVLive

- `sdk/`: pacchetto TypeScript `@digitalvirgo/dvlive-api`, con risposte e metadati HTTP tipizzati.
- `runner/`: runner Node.js originale, client, configurazione e specifica OpenAPI.
- `supabase/`: unica Edge Function **DVLive** e configurazione del backend.
- `script/`: smoke test per Supabase locale/remoto e test del proxy.

## Runner

```sh
cd runner
npm run help
npm run getShowVote
```

La configurazione locale esistente è in `runner/config.json` (ignorata da Git).
Vedi [runner/README.md](runner/README.md) per tutte le azioni.

## Edge Function

Endpoint: `https://<project-ref>.supabase.co/functions/v1/dvlive`.
La verifica del JWT Supabase dipende da `verify_jwt` in `supabase/config.toml`
(attualmente `false`). Gli smoke test inviano comunque gli header Supabase.
Passare il token DV Live in ogni chiamata operativa nell'header
`bearer-token: <token>` (senza prefisso `Bearer`), separato dal JWT Supabase.
La funzione lo inoltra all'API DV Live come `Authorization: Bearer <token>`.
Non è salvato nelle variabili d'ambiente della funzione. Il catalogo non richiede questo header.

La Edge Function usa `parseMode` dell'SDK per convertire il parametro query
nell'enum `ApiMode`. Se `mode` manca, è vuota o non è riconosciuta, restituisce
HTTP `200` con tutte le mode, descrizioni in inglese, metodo HTTP, parametri query
obbligatori, campi JSON e tipo della risposta. Il catalogo arriva direttamente
dall'SDK e non richiede token DV Live o configurazione dell'ambiente.
Le risposte e gli status dell'API DV Live vengono inoltrati senza wrapper aggiuntivi.

| mode | Metodo | Query oltre a `mode` | Body JSON | Risposta |
| --- | --- | --- | --- | --- |
| `getShowVoteChoice` | GET | `uuid` | — | Partecipante, stato, immagini, round |
| `getShowVote` | GET | `uuid` | — | Show, date e round corrente con partecipanti |
| `getVoter` | GET | `showVoteUuid`, `userRef` | — | Votante, saldo, stato antifrode |
| `createVoter` | POST | `showVoteUuid` | `email`, `phone`, `uniqRef` opzionali | Esito registrazione |
| `addVote` | POST | `showVoteUuid`, `userRef` | `additionalVoteType`, `nbPoints` | Esito accredito e voti rimanenti se presenti |
| `castVote` | POST | `showVoteUuid`, `userRef` | `votes` obbligatorio, campi antifrode opzionali | Esito voto e voti rimanenti se presenti |

`votes` è un array non vuoto di `{ "choiceUuid": "...", "nbVotes": 1 }`.
I campi antifrode sono `sessionToken`, `phoneFingerPrint`, `ip`, `userAgent`,
`uniqSubscriptionId`. L'SDK verifica il body, i tipi dei campi, gli enum e i valori di voto prima della chiamata HTTP; gli altri vincoli sono verificati dall'API upstream.
Per POST inviare `Content-Type: application/json`; i parametri query non vanno nel body.

```sh
curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=getShowVote&uuid=SHOW_UUID' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN"

curl 'http://127.0.0.1:54321/functions/v1/dvlive?mode=castVote&showVoteUuid=SHOW_UUID&userRef=VOTER_REF' \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "bearer-token: $DVLIVE_BEARER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"votes":[{"choiceUuid":"CHOICE_UUID","nbVotes":1}]}'
```

### Ambiente locale e deploy

`supabase/.env` contiene `DVLIVE_ENV`, con valore `STAG` o `PROD`:

```dotenv
DVLIVE_ENV=STAG
```

L'SDK sceglie il base URL in base all'ambiente: `STAG` usa
`https://dev-webshow-engine.dv-live.com`, `PROD` usa
`https://webshow-engine.dv-live.com`. La mappa è interna all'SDK. Un valore mancante o diverso da
`STAG` e `PROD` produce un errore di configurazione HTTP 500 per le chiamate operative.
Il catalogo resta disponibile anche senza configurazione.
Il file è ignorato da Git; su un nuovo checkout copiarlo da `supabase/.env.example`.

Con Supabase CLI e Docker disponibili, dalla root del repository:

```sh
supabase start
supabase functions serve dvlive --env-file supabase/.env
```

Per pubblicare nel proprio progetto:

```sh
supabase secrets set --env-file supabase/.env --project-ref PROJECT_REF
supabase functions deploy dvlive --project-ref PROJECT_REF
```

Il file `.env` viene passato esplicitamente con `--env-file`, secondo la
[documentazione Supabase](https://supabase.com/docs/guides/functions/secrets).
La configurazione JWT del gateway viene mantenuta come definita in `supabase/config.toml`.

## SDK

La Edge Function usa `@digitalvirgo/dvlive-api` tramite la mappatura locale in
`supabase/functions/dvlive/deno.json`. Non serve pubblicare il pacchetto per servire
la funzione in locale o includerlo nel deploy.

```ts
import { ApiService } from "@digitalvirgo/dvlive-api";

const api = new ApiService({
  environment: "STAG", // La Edge Function legge questo valore da DVLIVE_ENV.
  headers: () => ({ Authorization: `Bearer ${token}` }),
});
const result = await api.getShowVote(uuid);
// result.data: ShowVoteResponse; result.status: number; result.headers: Headers
return json(result.data, result.status);
```

Il wrapper resta interno all'SDK: il JSON pubblico rimane quello dell'API DV Live.
Lo status effettivo viene preservato; solo `Retry-After` viene inoltrato dagli header
upstream. Gli errori HTTP mantengono status e payload originali, anche testuali;
errori di validazione del body diventano `400`, errori di rete o decodifica `502`, timeout `504`.
Il timeout predefinito è 15 secondi; non vengono eseguiti retry automatici.

Struttura, interfacce, errori e uso del pacchetto: [sdk/README.md](sdk/README.md).

## Smoke test

Gli script seguono le convenzioni di `atom`: un file Bash per mode, helper comune,
variabili locali modificabili all'inizio di ogni test. Richiedono `curl` e `jq`.

```sh
# Impostare URL e token in script/smoke-dvlive-common.sh.
# Impostare gli identificativi nel blocco locale di ogni test.
./script/smoke-get-show-vote.sh
./script/smoke-get-show-vote-choice.sh
./script/smoke-get-voter.sh
```

Non serve fare `export`. Per Supabase remoto impostare `SUPABASE_URL` e
`SUPABASE_ANON_KEY` in `script/smoke-dvlive-common.sh`, insieme a
`DVLIVE_BEARER_TOKEN`.
In locale l'URL predefinito è `http://127.0.0.1:54321`; la chiave viene risolta
come in `atom`, da ambiente, `supabase status -o json`, poi chiave demo locale.
Il token DV Live viene inviato tramite `bearer-token` e non va nel `.env` del server.

Dettagli, script POST e variabili disponibili: [script/README.md](script/README.md).
I test locali con upstream simulato richiedono Node.js >=22.18, Bash, curl e jq:

```sh
npm ci --prefix sdk
./script/test.sh
```
