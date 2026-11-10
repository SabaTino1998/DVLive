# Changelog

All notable changes to this DVLive integration kit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
