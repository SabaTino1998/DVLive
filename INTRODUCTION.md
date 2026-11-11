# DVLive

Project version: **0.1.0** — see [`VERSION`](VERSION) and [`CHANGELOG.md`](CHANGELOG.md).

**DVLive** is Digital Virgo’s voting platform and the main backend for a voting event. It keeps the vote balances, the voting rules, and the statistics, and it exposes APIs to the app and to the other backends connected to the event.

It stores **votes**, **bonus votes**, and **purchased votes**; runs the voting mechanics (nomination rounds and the candidate list); configures rules such as the max cap and when voting starts and stops; accepts or refuses a voting request by applying those rules; adds or decreases the vote amount; and stores voting statistics.

**Smart User** creates the user and assigns the initial votes. DVLive turns the Smart User `userToken` into the voting user record. The app votes through Smart User; DVLive accepts or refuses the vote. Smart User also assigns purchased votes. **Bravigo** (the partner app) calls the voting API to show candidates, cast votes, and read balances. **Smart Journey** reads vote amounts from DVLive and assigns bonus votes and purchased votes onto the voting user. **DVPass** handles oneshot purchases: it fetches voting parameters and candidate details from DVLive, and notifies DVLive when an oneshot purchase completes.

## What this repository is

A local DVLive integration kit: a testing environment for the DV Live voting APIs, plus a versioned Supabase edge function and reference app that any Bolt.new-built product can adopt — not only Bravigo.

The kit version above is independent of the vendored `@digitalvirgo/dvlive-api` package version in [`supabase/functions/_shared/dvlive-sdk/package.json`](supabase/functions/_shared/dvlive-sdk/package.json).

## Aims

- Exercise the DV Live show, participant, voter, and cast-vote APIs via the **runner** against the upstream web show engine (see [`runner/dvlive-api.md`](runner/dvlive-api.md) and `openapi.json`).
- Ship a reusable edge function under [`supabase/functions/dvlive/`](supabase/functions/dvlive/) that authenticates callers with an app JWT, keeps the DV Live API token server-side, and returns a stable `{ ok, data }` / `{ ok, false, error }` envelope.
- Provide a reference Expo app, smoke scripts, and a maintainer contract so the same surface can be copied into Bravigo or sibling products.

## Layout

| Path | Role |
| ---- | ---- |
| [`runner/`](runner/) | Self-contained Node.js CLI that calls DV Live APIs from the command line. Config-driven actions in `run.js` and `dvliveClient.js`. Setup and actions: [`runner/README.md`](runner/README.md). API notes: [`runner/dvlive-api.md`](runner/dvlive-api.md). |
| [`supabase/functions/dvlive/`](supabase/functions/dvlive/) | Edge function (`index.ts`, `deno.json`). Secrets/env: `DVLIVE_ENV`, `DVLIVE_ALB_TOKEN_DEV`, `DVLIVE_ALB_TOKEN_STAG`, `DVLIVE_ALB_TOKEN_PROD` (selected by `DVLIVE_ENV`), optional `DVLIVE_LOG_*`. Modes: `getShowVote`, `getShowVoteChoice`, `getVoter`, `createVoter`, `castVote`. |
| [`supabase/functions/_shared/dvlive-sdk/`](supabase/functions/_shared/dvlive-sdk/) | Vendored TypeScript SDK `@digitalvirgo/dvlive-api` (request validation, models, transport). Package docs: [`README.md`](supabase/functions/_shared/dvlive-sdk/README.md). |
| [`supabase/functions/bolt-auth-proxy/`](supabase/functions/bolt-auth-proxy/) | Bravigo-aligned SmartUser sync and app JWT issuance (unchanged proxy). |
| [`frontend/`](frontend/) | Expo SDK 54 reference app (web, iOS, Android) with SmartUser login and the five voting modes. |
| [`script/`](script/) | Per-mode Bash smoke tests against a running edge function (plus direct `add-vote`). |
| [`supabase/AGENTS.md`](supabase/AGENTS.md) | Maintainer contract for the edge adapter and SDK boundary. |
| [`README.md`](README.md) | Operational how-to: auth, modes, deploy, and smoke commands. |

## Current status

This **0.1.0** tag covers the show (`getShowVote`), participant (`getShowVoteChoice`), voter (`getVoter` / `createVoter`), and cast-vote (`castVote`) APIs through the runner, edge function, SDK, Expo app, and smoke scripts. App JWT authentication and server-side `DVLIVE_ALB_TOKEN_DEV`, `DVLIVE_ALB_TOKEN_STAG`, `DVLIVE_ALB_TOKEN_PROD` (selected by `DVLIVE_ENV`) are part of the edge contract.

Bonus votes, purchased votes, DVPass oneshot flows, and voting statistics are part of the DVLive platform described above. They are not claimed as implemented surfaces in this kit tag.

Operational detail lives in [`README.md`](README.md). Maintainer rules for the edge and SDK live in [`supabase/AGENTS.md`](supabase/AGENTS.md).

## How to start

1. Go to [`runner/`](runner/).
2. Copy `config.example.json` to `config.json` and fill `baseUrl` and `bearerToken`.
3. Run `npm run help` for the action list, or see [`runner/README.md`](runner/README.md).

To exercise the edge function and Expo app locally, copy `supabase/.env.example` and `frontend/.env.example`, then follow [`README.md`](README.md).

When this kit improves in a meaningful way, bump [`VERSION`](VERSION) and append an entry to [`CHANGELOG.md`](CHANGELOG.md) (patch for docs/fixes, minor for features, major for breaking edge/API contract changes).
