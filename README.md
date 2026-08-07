# moorebi

**This repository contains no application code.** As of 2026-08-07 it holds a single
`.gitkeep` and the strategy artefacts under [`docs/`](docs/).

## Where MOORE BI actually lives

| Asset | Location | Status |
|---|---|---|
| Application code | `vibecreators/MOORE` | Live — 319 files, 48 routes, 39 migrations |
| Database | Supabase `moore-os` (`cktzzimjziuantrgemxe`) | Live — 47 tables, RLS on all |
| Canonical strategy artefacts | `vibecreators/MOORE` → `docs/` | Live — 9 of 40 required files exist |
| Build memory | `vibecreators/MOORE` → `outputs/` | Live — 41 files, ~125 cycles |
| Deploy target | Netlify site `moore-os` | Configured; auto-deploy unverified |

**The source of truth for the MOORE BI programme is `vibecreators/MOORE`, not this
repository.** Nothing here supersedes it.

## Why this repository exists

Unresolved. The name matches the MOORE OS → **MOORE BI** product rename recorded in
`outputs/moore-bi-brand-migration.md` (Cycle 31), which explicitly *deferred* the
repository rename as "cosmetic; would rewrite webhook URLs — do with care". This repo may
be the intended destination of that deferred migration, or it may be unrelated.

**This is an open question for the founder** — see
[`docs/00-phase-0-audit.md` §9](docs/00-phase-0-audit.md). Until it is answered, no code
or canonical artefact should be authored here, because doing so forks the programme's
source of truth. That failure has already occurred once: the Notion page *"MOORE OS — Build
Loop Memory (Cycle 1)"* still reports "14 tables" and a completed MVP, against a live
system that has since reached 47 tables and ~125 cycles.

## Contents

- [`docs/00-phase-0-audit.md`](docs/00-phase-0-audit.md) — Phase 0 orchestrator audit,
  independent re-verification of the standing risk register, two new defects, and the
  Build-Readiness Decision.
