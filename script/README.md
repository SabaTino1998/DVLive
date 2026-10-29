# DVLive smoke tests

Richiedono Bash, curl, jq, una Edge Function DVLive attiva e un token DV Live valido.
Seguono la struttura degli smoke test di `atom`: uno script per mode, helper comune,
variabili locali in ogni script, URL e stato HTTP stampati, risposta JSON verificata.

URL e credenziali sono configurati una sola volta all'inizio di
`smoke-dvlive-common.sh`. Modificare i valori dopo `:-`; non serve eseguire `export`:

```sh
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
DVLIVE_BEARER_TOKEN="${DVLIVE_BEARER_TOKEN:-TOKEN_DV_LIVE}"
```

Lasciare `SUPABASE_ANON_KEY` vuota per il rilevamento locale automatico.
Ogni test mantiene solo i propri parametri nel blocco iniziale, per esempio
`SHOW_VOTE_UUID`, `CHOICE_UUID`, `USER_REF` e i campi del body.
Poi eseguire dalla root del repository:

```sh
./script/smoke-get-show-vote.sh
./script/smoke-get-show-vote-choice.sh
./script/smoke-get-voter.sh
./script/smoke-catalog.sh
```

| Script | Mode | Controllo |
| --- | --- | --- |
| `smoke-get-show-vote.sh` | `getShowVote` | Nome, date e round opzionale dello show |
| `smoke-get-show-vote-choice.sh` | `getShowVoteChoice` | UUID, show, nome, stato e ordine del partecipante |
| `smoke-get-voter.sh` | `getVoter` | Riferimento, punti, stato antifrode e saldo |
| `smoke-create-voter.sh` | `createVoter` | HTTP 201 ed esito registrazione |
| `smoke-add-vote.sh` | `addVote` | HTTP 201 ed esito accredito |
| `smoke-cast-vote.sh` | `castVote` | HTTP 201 ed esito voto |
| `smoke-catalog.sh` | Assente o non valida | Catalogo completo, descrizioni in inglese e parametri richiesti |

Le mode rimangono nei parametri URL. Le operazioni GET non inviano un body;
le operazioni POST inviano JSON. Le risposte dell'API DV Live rimangono inalterate,
senza introdurre l'envelope `ok` di Atom. HTTP inatteso, errore di trasporto o risposta
non valida terminano con exit code 1. Con `OUT_FILE` il JSON viene salvato nel file
indicato, sostituendolo se esiste; altrimenti viene stampato.

## Configurazione locale

| Variabile | Default / utilizzo |
| --- | --- |
| `SUPABASE_URL` | `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | Ambiente, poi `supabase status -o json`, poi chiave demo locale |
| `REPO_ROOT` | Repository corrente, usato per `supabase status` |
| `DVLIVE_BEARER_TOKEN` | Obbligatorio per le sei mode; header `bearer-token`, senza prefisso Bearer |
| `SHOW_VOTE_UUID` | `00000000-0000-4000-8000-000000000001` (esempio del runner) |
| `CHOICE_UUID` | `22222222-2222-4222-8222-222222222201` (esempio del runner) |
| `USER_REF` | `dvlive-smoke` |
| `OUT_FILE` | Opzionale: esporta la risposta JSON |
| `EXPECTED_STATUS` | Opzionale per POST: 201 per tutte le operazioni POST |

Sostituire gli identificativi di esempio con risorse esistenti nell'ambiente scelto.
Il catalogo viene restituito con HTTP 200 se `mode` manca o il parser dell'SDK non
la riconosce. Include descrizioni in inglese e parametri richiesti; lo smoke test
verifica il caso senza mode e i valori non validi `unknown` e `__proto__`.
Il catalogo non richiede il token DV Live. L'autenticazione del gateway dipende
da `verify_jwt` nel progetto Supabase; gli script inviano comunque gli header Supabase.
Per progetti remoti inserire URL e chiave Supabase nel blocco condiviso di
`smoke-dvlive-common.sh`.

Quando la verifica JWT del gateway è abilitata, usare un JWT accettato dal progetto,
per esempio una chiave anon JWT legacy. Le nuove chiavi publishable non sono JWT.
L'unica variabile server in `supabase/.env` è `DVLIVE_ENV=STAG` oppure
`DVLIVE_ENV=PROD`, caricata passando `--env-file supabase/.env` a
`supabase functions serve dvlive`. L'SDK configura il base URL: `STAG` usa
`https://dev-webshow-engine.dv-live.com`, `PROD` usa `https://webshow-engine.dv-live.com`. Il token DV Live resta
nella configurazione comune degli smoke test e viene passato nelle chiamate.
Non occorre un file JSON di configurazione per gli smoke test.

## Operazioni POST

Questi script modificano i dati. Usare uno show di test attivo e un nuovo `USER_REF`;
per un flusso completo impostare lo stesso riferimento nei blocchi locali dei tre
script ed eseguirli nell'ordine seguente:

```sh
./script/smoke-create-voter.sh
./script/smoke-add-vote.sh
./script/smoke-cast-vote.sh
```

`createVoter` accetta `EMAIL` e `PHONE` opzionali.
`addVote` usa `NB_POINTS=1` e `ADDITIONAL_VOTE_TYPE=VIDEO` come default.
`castVote` invia un voto per `CHOICE_UUID`; `VOTES` permette di passare un array JSON:

```sh
# Impostare VOTES nel blocco locale di smoke-cast-vote.sh, poi eseguire:
./script/smoke-cast-vote.sh
```

I campi antifrode opzionali sono `SESSION_TOKEN`, `PHONE_FINGER_PRINT`, `IP`,
`USER_AGENT` e `UNIQ_SUBSCRIPTION_ID`.

## Esecuzione dei test

Eseguire gli smoke test singolarmente, uno per ogni operazione, contro una Edge
Function locale o remota attiva. Configurare URL, token e identificativi come
indicato sopra. Gli script effettuano chiamate reali; quelli POST modificano i dati.

Gli status POST predefiniti sono `201`, come nell'OpenAPI; `EXPECTED_STATUS` permette
di testarli anche contro ambienti che restituiscono uno status differente.

I test dell'SDK rimangono separati e usano risposte HTTP simulate:

```sh
npm ci --prefix sdk
npm --prefix sdk run check
npm --prefix sdk test
```
