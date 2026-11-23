# Changelog

All notable changes to this DVLive integration kit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-23 (Released)

### Added

- Added `DEV` as a DV Live environment and `DVLIVE_MODE` to select internal (`INT`) or external (`PROD`, the default) upstream hosts. In `PROD`, the Edge Function sends `X-Internal-Auth` when the matching `DVLIVE_ALB_TOKEN_<environment>` is configured.
- `getShowVote` now returns `data.timezone` with the show's IANA time zone. The SDK requires this string in the upstream response and includes it in the public `ShowVote` model.
- `getShowVoteChoice` now includes the authenticated voter's `data.balance` and `data.remainingPoints`, plus the show's current `data.round` with `startDay` and `endDay` (or `null` when there is no round). Participant details also expose the optional `isNominated` flag, which the Expo app uses to display nomination status.
- Added `npm run addVote` to the Node.js runner to credit voter points directly through the upstream API, and added mocked coverage for access modes and authentication headers.

### Changed

- **Breaking configuration change.** Replace `DVLIVE_API_TOKEN` with `DVLIVE_API_TOKEN_DEV`, `DVLIVE_API_TOKEN_STAG`, or `DVLIVE_API_TOKEN_PROD` to match `DVLIVE_ENV`. The selected token is required in both modes. `STAG` now targets the staging host. Use `DEV` if the integration needs to keep using the development host previously selected by `STAG`.
- **Breaking behavior change.** The Edge Function's `getShowVoteChoice` now requires `absolute_reference` in the verified app JWT and a voter for the participant's show. A failure fetching the choice, voter, or show fails the whole request. The direct runner now requires `showVoteChoice.userRef` to fetch the same details.
- The direct runner now uses `DVLIVE_ENV`, `DVLIVE_MODE`, and the matching token settings in place of `baseUrl` and `bearerToken`. The standalone `add-vote` smoke script also selects its bearer token by environment. The show and participant smoke scripts check the new response fields.

## [0.1.0] - 2026-11-10

### Added

- [`INTRODUCTION.md`](INTRODUCTION.md) — kit overview, product description, and layout.
- [`VERSION`](VERSION) and this changelog — lightweight kit versioning (independent of the `@digitalvirgo/dvlive-api` package version).
- Node.js API reference runner under [`runner/`](runner/) (`dvliveClient.js`, `run.js`, OpenAPI notes).
- Supabase edge function [`supabase/functions/dvlive/`](supabase/functions/dvlive/) with modes `getShowVote`, `getShowVoteChoice`, `getVoter`, `createVoter`, and `castVote`.
- Vendored TypeScript SDK [`@digitalvirgo/dvlive-api`](supabase/functions/_shared/dvlive-sdk/) mapped locally through the edge `deno.json`.
- Bravigo-aligned auth: [`bolt-auth-proxy`](supabase/functions/bolt-auth-proxy/), app JWT verification, and local auth bootstrap migration.
- Expo reference app under [`frontend/`](frontend/).
- Per-mode smoke scripts under [`script/`](script/).
- Maintainer contract in [`supabase/AGENTS.md`](supabase/AGENTS.md).

### Notes

- This entry records the first tagged baseline of the kit, not a migration from an earlier release.
- Kit version **0.1.0** is separate from the SDK package version in `supabase/functions/_shared/dvlive-sdk/package.json`.
