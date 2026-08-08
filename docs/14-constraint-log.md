# 14 — Constraint Log

## C-001 — Main constraint (carried forward from the predecessor, reopened 2026-08-07)

### Statement

> **The binding constraint on MOORE OS is the absence of a single real operator using the
> system on a weekly rhythm.** Not engineering capacity, not architecture, not AI quality.

### Status: **STRONG HYPOTHESIS** — and the rebuild does not touch it

The predecessor produced ~125 build cycles, 47 tables and 48 routes against **zero customer
interviews, zero external operators and one lifetime approval**. Starting a new codebase
changes the supply side only. The constraint is on the demand side and is unchanged.

### Evidence refreshed this cycle

| Finding | Method |
|---|---|
| The two "sign-ins today" that might have indicated a live user were `emeka@bloompetal.ng` and `musa@naijafresh.ng` — **the two accounts the RLS suite logs in as**. Someone ran the tests; nobody used the product. | `auth.users` cross-referenced against `tests/rls.test.ts:22-23` |
| All four workspaces were fictional (Bloom & Petal, Naija Fresh, PH AutoCare, "side gig"). | direct query before the drop |
| All nine accounts were seeded; **zero real users have ever existed**. | direct query |

This **closes the open question** from the Phase 0 audit (E-15) and removes the one piece of
evidence that could have refuted C-001. The hypothesis is now stronger, not weaker.

### Competing explanations still live

| # | Alternative | Distinguishing test |
|---|---|---|
| B | MOORE has **service** clients who were never asked to use the software. | Name one. If they exist, the constraint is conversion, not demand. |
| D | This is deliberately a demo asset for investors/prospects, not a product for users. | Founder states intent. If true, the objective changes from "get a pilot" to "make one narrative flawless". |
| E | **Demand was never tested.** Zero interviews exist, so "no demand" and "never asked" are indistinguishable. | Five switch interviews. One afternoon. |

E remains the cheapest and most informative test available to the programme, and it has still
not been run.

### What would disprove C-001

A named business outside the founder's control signing in weekly for three consecutive weeks
and completing ≥10 approve-or-dismiss decisions.

---

## C-002 — Retired

The predecessor's estimate-labelled-as-revenue defect. Repaired there before retirement, and
structurally impossible here: `opportunities.estimated_value` carries an `estimate_status`
and is never summed under a revenue label (`docs/20-domain-model.md`).

---

## C-003 — Verification constraint (opened 2026-08-07) — **RESOLVED this cycle**

**Statement:** the predecessor's tenant-isolation suite self-skipped without secrets, so
isolation was never proven by any repeatable gate.

**Resolution.** `tests/isolation.test.ts` **fails** rather than skips when its credentials are
absent, and CI supplies them. Isolation was additionally proven directly against the live
schema this cycle: 12/12 checks passed, covering cross-tenant read, write, update, delete and
view access.

**Residual:** the CI secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `TEST_USER_PASSWORD`) must be added to the repository before CI
can go green. Until then CI is **correctly red** — that is the gate working as designed, not
a fault.

---

## C-004 — View-layer authorization (opened and closed 2026-08-07)

**Statement:** `invoice_settlement` was created without `security_invoker`, so it executed as
its owner and **bypassed RLS on the tables beneath it**. Any authenticated user could have
read every tenant's invoices and payments through it.

**Status: CONFIRMED, then FIXED** (migration `0002`). Verified: tenant B now reads 0 rows
through the view.

**Mechanism worth preserving.** "RLS enabled on every table" was true the whole time and did
**not** prevent this. Row-level security protects tables; a view is a separate object with its
own execution context. A tenancy audit that counts `rowsecurity` flags will miss this class
of hole entirely.

**Generalization adopted:** every view added to this codebase must set
`security_invoker = true`, and the isolation suite must query each view directly rather than
only its underlying tables.
