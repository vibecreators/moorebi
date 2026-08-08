# 15 — Decision Log

Material decisions live here, never only in chat. Each records authority, alternatives,
expected mechanism, and a review date.

---

## D-001 · Retire the predecessor build and restart

**Date:** 2026-08-07 · **Authority:** Founder (explicit) · **Category:** REDESIGN

**Decision.** Stop building on `vibecreators/MOORE`. Begin a new build in
`vibecreators/moorebi` against the revised MOORE OS blueprint.

**Reason.** The founder states the MOORE concept has changed significantly. The predecessor
was built to a different product definition — 47 tables, 48 routes, ~125 cycles — and its
ontology (leads, tasks, SOPs, inventory) does not express the new one (entity, stakeholder,
constraint, hypothesis, intervention, outcome, learning).

**Alternatives considered.** (a) Refactor in place — rejected: the object model differs at the
root, so the migration would be larger than the rebuild and would inherit ~125 cycles of
accumulated surface. (b) Fork and prune — rejected: same, and it preserves the drift.

**Expected mechanism.** A schema built directly on the ontology makes the charter's invariants
structural rather than conventional — see D-003.

**Recorded dissent (mine, preserved per the orchestrator contract).** The predecessor's
binding constraint was **demand evidence, not code**: zero customer interviews, zero external
operators, one lifetime approval. A rebuild does not relieve that constraint — it produces
more supply against unchanged demand. The rebuild is the founder's call and is being executed
in full; this entry exists so no later cycle mistakes a fresh codebase for validation.

**Review date.** At the Phase 1 pilot gate.

---

## D-002 · Reuse all existing infrastructure connections

**Date:** 2026-08-07 · **Authority:** Founder (explicit) · **Category:** KEEP

**Decision.** Carry over Supabase project `moore-os` (`cktzzimjziuantrgemxe`), PostHog
project 198696 (EU), the Netlify site, the n8n webhook and the Anthropic key. No new
credentials are issued.

**Consequence.** PostHog analytics history is continuous across the rebuild, which is useful
for baselining but means event series span two different products. Events from the new build
are namespaced so the two are separable.

---

## D-003 · Clean slate in the `public` schema

**Date:** 2026-08-07 · **Authority:** Founder (explicit, from three options) · **Category:** REDESIGN

**Decision.** Drop the predecessor's 47 tables and seeded demo auth users; rebuild `public`
from the new ontology.

**Basis of safety.** Every workspace was fictional (Bloom & Petal Florals, Naija Fresh Foods,
PH AutoCare, "side gig") and all nine accounts were seeded (`@moore.os`, `@bloompetal.ng`,
`@naijafresh.ng`, `@phautocare.ng`). **No real business records existed.** Verified by direct
query before the drop.

**Alternatives.** (a) Separate `moore` schema — non-destructive but needs a manual Exposed
Schemas change. (b) New Supabase project — cleanest isolation but re-keys everything, which
the founder ruled out.

**Reversibility.** The predecessor's 39 migrations and seed scripts remain in
`vibecreators/MOORE`; the old schema can be reconstituted into a fresh project if ever needed.

---

## D-004 · Collected cash is a separate table, not a column

**Date:** 2026-08-07 · **Authority:** Orchestrator (architecture) · **Category:** BUILD

**Decision.** `invoices` never carries a `paid` boolean or a nullable `paid_at`. Collected
cash is the sum over `payments` and nothing else.

**Mechanism.** The predecessor's R-02 defect — imported "paid" invoices leaving `paid_at`
null, so collected cash read ₦0 and the engine announced a phantom cash crisis — was possible
because the truth of "collected" lived in a field an import could forget. A row cannot be
forgotten in the same way: no payment row, no collected cash, and the two numbers are never
derived from the same column.

**Falsification.** If an importer needs to represent historical paid invoices, it must create
payment rows. A test imports 300 historically-paid invoices and asserts collected cash is
non-zero and equals the sum of payments.
