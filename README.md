# MOORE OS

The operating-intelligence layer for founder-led businesses. It sits above and between the
systems a business already runs, and carries it around one loop:

`OBSERVE → MODEL → VALIDATE → DIAGNOSE → DECIDE → EXECUTE → REVIEW → LEARN → REMEMBER`

Start with [`docs/00-product-charter.md`](docs/00-product-charter.md).

## Status

**Phase 1 — Operating Control · foundation laid, no UI yet.**

| Piece | State |
|---|---|
| Ontology and schema | ✅ 19 tables, live on Supabase `moore-os` |
| Tenant isolation | ✅ proven — 12/12 checks against the live schema |
| Money invariants | ✅ 11/11 tests |
| Security advisor | ✅ zero findings |
| Application UI | ⬜ next cycle |
| Copilot | ⬜ next cycle |

## This is a rebuild

It replaces an earlier build in `vibecreators/MOORE`, retired on 2026-08-07 because the MOORE
concept changed materially ([D-001](docs/15-decision-log.md)). All infrastructure connections
were carried over — same Supabase project, same PostHog project, same Netlify site, **no new
credentials** ([D-002](docs/15-decision-log.md)).

The predecessor's audit is preserved in
[`docs/00-phase-0-audit.md`](docs/00-phase-0-audit.md). Several of its findings are encoded
here as regression guards rather than prose:

- Collected cash lives only in `payments` — there is no `paid` flag to forget to set.
- Estimates carry an `evidence_status` and are never summed under a revenue label.
- Re-notification requires a state change and a capped escalation step.
- The isolation suite **fails** when it cannot run, instead of skipping silently.

## Setup

```bash
npm ci
cp .env.example .env.local     # fill SUPABASE_SERVICE_ROLE_KEY and TEST_USER_PASSWORD
npm run dev
```

## Tests

```bash
npm test              # everything
npm run test:isolation # cross-tenant isolation only
```

`tests/isolation.test.ts` creates two disposable tenants against the live project and deletes
them afterwards. It requires `SUPABASE_SERVICE_ROLE_KEY` and `TEST_USER_PASSWORD`, and
**fails rather than skips** without them — an unprovable isolation boundary is
indistinguishable from a broken one.

## Migrations

`supabase/migrations/` mirrors what is applied to the live project, in order. `0002` and
`0003` exist because an isolation probe caught three defects in `0001` that reading it had
not: missing grants, a view that bypassed RLS, and auth helpers whose `EXECUTE` had been
revoked from the very policies that call them. Each is documented in place.

## Documents

| | |
|---|---|
| [00 Product charter](docs/00-product-charter.md) | What this is, the product test, the invariants |
| [14 Constraint log](docs/14-constraint-log.md) | What is actually limiting the programme |
| [15 Decision log](docs/15-decision-log.md) | Material decisions, with preserved dissent |
| [18 Roadmap](docs/18-product-roadmap.md) | Phases, and the Phase 1 release definition |
| [20 Domain model](docs/20-domain-model.md) | The seventeen-object ontology |
| [00 Phase 0 audit](docs/00-phase-0-audit.md) | Audit of the retired predecessor |
