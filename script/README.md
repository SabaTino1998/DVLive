# DVLive smoke tests

Richiedono Bash, curl, jq e un token DV Live valido. Le operazioni SDK richiedono
una Edge Function DVLive attiva; lo smoke `add-vote` chiama direttamente DV Live.
Seguono la struttura degli smoke test di `atom`: uno script per mode, helper comune,
variabili locali in ogni script, URL e stato HTTP stampati, risposta JSON verificata.

La configurazione condivisa degli smoke è in `script/config.json`, escluso da Git.
Non serve `export` e gli smoke non leggono `frontend/.env`. Per un nuovo checkout:

```sh
cp script/config.example.json script/config.json
```

Compilare i campi stringa del JSON: App ID, secret e ambiente SmartUser,
username/email e password del test, bearer DV Live e `SHOW_VOTE_UUID`.
`SUPABASE_URL` e `SUPABASE_ANON_KEY` sono opzionali; lasciare la chiave vuota
per il rilevamento locale automatico. `DVLIVE_ENV` opzionale seleziona STAG/PROD
per lo smoke add-vote diretto (default STAG).

`smoke-config.sh` legge solo le chiavi riconosciute con jq, senza eseguire il
contenuto del JSON. Conserva i caratteri speciali dei secret.
I valori condivisi del JSON prevalgono sui default degli script.
Ogni test mantiene i parametri specifici nel blocco locale: `CHOICE_UUID`,
`USER_REF`, `EMAIL`, `PHONE` e i campi del body. Il token N_ resta da copiare a mano.
Poi eseguire dalla root del repository:

```sh
./script/smoke-get-show-vote.sh
./script/smoke-get-show-vote-choice.sh
./script/smoke-get-voter.sh
./script/smoke-catalog.sh
```

## Recuperare un token SmartUser

Il file locale `test-support/.npmrc`, escluso da Git, configura il registry e il token npm
come in Bravigo. Configurarlo prima di installare le dipendenze dell'helper (Node.js >=18):

```sh
npm install --prefix test-support
```

Configurare in `script/config.json` `EXPO_PUBLIC_SMARTUSER_APP_ID`,
`EXPO_PUBLIC_SMARTUSER_SECRET`, `EXPO_PUBLIC_SMARTUSER_ENV`, `SMART_USER_USERNAME`
e `SMART_USER_PASSWORD`. Poi eseguire:

```sh
bash script/smoke-smartuser-token.sh
```

Questo smoke esegue il setup SmartUser, poi sempre il login username/password
con `loginWithEmail()`, e stampa il token `N_…` restituito da
`getUserToken()`. Non chiama DV Live e non recupera email o telefono.
Se setup o login falliscono, oppure il token dopo il login non è `N_…`, termina con errore.
Copiare manualmente il token nel blocco locale di ciascuno smoke voter da eseguire:

```sh
USER_REF="${USER_REF:-N_TOKEN_COPIATO_DAL_TEST_SMARTUSER}"
```

Gli smoke voter non chiamano SmartUser; richiedono un `USER_REF` con prefisso `N_`.
Configurare email e telefono manualmente, se desiderati, in `smoke-create-voter.sh`.
Non serve `export`. Non committare credenziali o token reali inseriti nella configurazione locale.
Il debug SDK è attivo nei due smoke SmartUser: i log e l’errore originale sono
stampati su stderr con i valori originali, incluse credenziali e token.
Il log di setup mostra anche la lunghezza del secret ricevuto dall’helper.
Gli smoke SmartUser mostrano i token nei log e stampano il token finale per consentirne la copia;
nei log degli smoke voter il riferimento viene nascosto. `OUT_FILE`, se configurato, salva la risposta
originale e potrebbe contenerlo.

## Creare un utente SmartUser

Configurare App ID, secret, ambiente, `SMART_USER_USERNAME` (email del nuovo utente)
e `SMART_USER_PASSWORD` in `script/config.json`.
Non occorre eseguire `export`. Dopo aver installato le dipendenze come sopra:

```sh
bash script/smoke-smartuser-signup.sh
```

Il test esegue `setup → signupWithEmail → loginWithEmail → getUserToken` e
stampa il token `N_…`, da copiare manualmente negli smoke voter.
Crea un utente reale nell'ambiente selezionato: usare un'email nuova.
Se il signup fallisce (per esempio utente già esistente), termina senza tentare il login.
Per un utente già creato, usare `smoke-smartuser-token.sh`.

Per verificare l'helper senza credenziali né chiamate reali:

```sh
node --test test-support/smartuser.test.mjs
```

| Script | Mode | Controllo |
| --- | --- | --- |
| `smoke-get-show-vote.sh` | `getShowVote` | Nome, date e round opzionale dello show |
| `smoke-get-show-vote-choice.sh` | `getShowVoteChoice` | UUID, show, nome, stato e ordine del partecipante |
| `smoke-get-voter.sh` | `getVoter` | Riferimento, punti, stato antifrode e saldo |
| `smoke-create-voter.sh` | `createVoter` | HTTP 201 ed esito registrazione |
| `smoke-add-vote.sh` | DV Live diretto, senza Supabase | HTTP 201 ed esito accredito |
| `smoke-cast-vote.sh` | `castVote` | HTTP 201 ed esito voto |
| `smoke-smartuser-signup.sh` | Setup, signup e login SmartUser | Crea utente con email/password e stampa il token `N_…` |
| `smoke-smartuser-token.sh` | Setup e login SmartUser | Stampa il token `N_…` da copiare manualmente |
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
| `DVLIVE_BEARER_TOKEN` | Obbligatorio per le cinque mode; header `bearer-token`, senza prefisso Bearer |
| `SHOW_VOTE_UUID` | `00000000-0000-4000-8000-000000000001` (esempio del runner) |
| `CHOICE_UUID` | `22222222-2222-4222-8222-222222222201` (esempio del runner) |
| `USER_REF` | Token `N_…` copiato manualmente dallo smoke SmartUser |
| `OUT_FILE` | Opzionale: esporta la risposta JSON |
| `EXPECTED_STATUS` | Opzionale per POST: 201 per tutte le operazioni POST |

Sostituire gli identificativi di esempio con risorse esistenti nell'ambiente scelto.
Il catalogo viene restituito con HTTP 200 se `mode` manca o il parser dell'SDK non
la riconosce. Include descrizioni in inglese e parametri richiesti; lo smoke test
verifica il caso senza mode e i valori non validi `unknown` e `__proto__`.
Il catalogo non richiede il token DV Live. L'autenticazione del gateway dipende
da `verify_jwt` nel progetto Supabase; gli script inviano comunque gli header Supabase.
Per progetti remoti inserire URL e chiave Supabase in `script/config.json`.

Quando la verifica JWT del gateway è abilitata, usare un JWT accettato dal progetto,
per esempio una chiave anon JWT legacy. Le nuove chiavi publishable non sono JWT.
La variabile server obbligatoria in `supabase/.env` è `DVLIVE_ENV=STAG` oppure
`DVLIVE_ENV=PROD`, caricata passando `--env-file supabase/.env` a
`supabase functions serve dvlive`. L'SDK configura il base URL: `STAG` usa
`https://dev-webshow-engine.dv-live.com`, `PROD` usa `https://webshow-engine.dv-live.com`. Il token DV Live resta
nella configurazione comune degli smoke test e viene passato nelle chiamate.
Il file `script/config.json` è dedicato agli smoke e indipendente dalla configurazione Expo.

## Operazioni POST

Questi script modificano i dati.
Usare uno show di test attivo e un nuovo `USER_REF`;
per un flusso completo impostare lo stesso riferimento nei blocchi locali dei tre
script ed eseguirli nell'ordine seguente:

```sh
./script/smoke-create-voter.sh
./script/smoke-add-vote.sh
./script/smoke-cast-vote.sh
```

`createVoter` accetta `EMAIL` e `PHONE` opzionali. Se è disponibile solo l’email,
impostare `EMAIL` e lasciare `PHONE` vuota: il campo `phone` viene omesso dal JSON.
Questi campi sono dati del voter e non credenziali per il login SmartUser.
`smoke-add-vote.sh` è indipendente da Supabase e dall’SDK, ma legge lo stesso
`script/config.json` per `DVLIVE_BEARER_TOKEN`, `SHOW_VOTE_UUID` e l’eventuale
`DVLIVE_ENV`. `USER_REF`, `NB_POINTS` e `ADDITIONAL_VOTE_TYPE` restano nel
blocco locale dello smoke, senza `export`.
Invia con curl `POST /show-vote/{showVoteUuid}/voter/{userRef}/add-vote`, con body
`{ "additionalVoteType": "VIDEO", "nbPoints": 1 }` e header
`Authorization: Bearer <token DV Live>`. Non usa chiavi né header Supabase.
`STAG` usa `https://dev-webshow-engine.dv-live.com`; `PROD` usa
`https://webshow-engine.dv-live.com`. `USER_REF` è il token SmartUser copiato manualmente.
Questa operazione non è più esposta nel catalogo SDK/Edge Function né nel runner.
`castVote` invia un voto per `CHOICE_UUID`; `VOTES` permette di passare un array JSON:

```sh
# Impostare VOTES nel blocco locale di smoke-cast-vote.sh, poi eseguire:
./script/smoke-cast-vote.sh
```

I campi antifrode opzionali sono `SESSION_TOKEN`, `PHONE_FINGER_PRINT`, `IP`,
`USER_AGENT` e `UNIQ_SUBSCRIPTION_ID`.

## Esecuzione dei test

Eseguire gli smoke test singolarmente: le operazioni SDK usano una Edge Function
locale o remota attiva; `smoke-add-vote.sh` chiama direttamente DV Live. Configurare URL, token e identificativi come
indicato sopra. Gli script effettuano chiamate reali; quelli POST modificano i dati.

Gli status POST predefiniti sono `201`, come nell'OpenAPI; `EXPECTED_STATUS` permette
di testarli anche contro ambienti che restituiscono uno status differente.

I test dell'SDK rimangono separati e usano risposte HTTP simulate:

```sh
npm ci --prefix supabase/functions/_shared/sdk
npm --prefix supabase/functions/_shared/sdk run check
npm --prefix supabase/functions/_shared/sdk test
```

Per abilitare il logger dell’SDK nella Edge Function, impostare in `supabase/.env`
`DVLIVE_LOG_ENABLE=TRUE` e `DVLIVE_LOG_LEVEL=WARNING`, `INFO` o `DEBUG`.
Se assenti, i default sono `FALSE` e `WARNING`: nessun log viene emesso.
I log si vedono nel terminale Supabase o nei log della funzione pubblicata,
non nell’output curl degli smoke. Riavviare `supabase functions serve` dopo la modifica.
