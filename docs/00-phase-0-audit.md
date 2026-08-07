# 00 — Phase 0 Orchestrator Audit & Build-Readiness Decision

**Cycle:** Phase 0 re-entry · **Date:** 2026-08-07
**Orchestrator scope:** `vibecreators/moorebi` (empty) + `vibecreators/MOORE` (read) +
Supabase `moore-os` (`cktzzimjziuantrgemxe`, read) + Notion build memory.

> **Primary decision: REPAIR — two S1 defects only. No new capability. See §8.**

---

## 1. Scope

What was examined: the complete MOORE BI system as it exists on 2026-08-07 — application
repository, live database, standing risk register, and the strategy artefacts written by
the previous orchestrator cycle earlier the same day.

The directive instructed me to re-verify previously reported risks rather than trust them
("Do not assume earlier reports remain accurate. Inspect and test them."). I did. Three
standing claims were wrong — two stale-pessimistic, one stale-optimistic — and two
material defects were found that no register contains.

## 2. Inputs

- `vibecreators/moorebi` @ `6dc4af5` — 1 commit, 1 empty file.
- `vibecreators/MOORE` @ `cd1bb1d` — 319 tracked files; `npm ci` + `npm test` executed.
- Supabase `moore-os` — `list_tables`, `list_migrations`, security advisors, and direct
  SQL against `notifications`, `ai_usage`, `ai_recommendations`, `auth.users`.
- `MOORE/docs/` (9 files) and `MOORE/outputs/` (41 files).
- Notion: *"MOORE OS — Build Loop Memory (Cycle 1)"*.

**Not examined:** Netlify deploy state, PostHog analytics, n8n. Flagged as Unknown in §7.

## 3. Evidence

### Confirmed — by direct execution or query

| # | Finding | Method |
|---|---|---|
| E-1 | `moorebi` is empty: one commit, one `.gitkeep`, no history on any branch. | `git log --all`, `git ls-tree` |
| E-2 | The live DB has **47 tables**, RLS enabled on every one. | `list_tables` |
| E-3 | Migration sequence is **complete and consistent** — 39 files, 0001→0043, no gaps; repo `0039_s2_hardening.sql` is the mirror of DB `revoke_trigger_function_rpcs`. | file listing + `list_migrations` + content read |
| E-4 | Test suite: **221 passed, 8 skipped**, 0 failed. | `npm test` |
| E-5 | The 8 skipped tests are the **entire RLS cross-tenant suite (6) and the entire prompt-injection suite (2)**. | `tests/rls.test.ts:14-16`, `tests/prompt-injection.test.ts:11` |
| E-6 | CI supplies only placeholder public env vars; neither `SEED_DEMO_PASSWORD` nor `ANTHROPIC_API_KEY` is set. | `.github/workflows/ci.yml` |
| E-7 | **1,115 notifications exist; 1,115 are unread.** Zero have ever been opened. | SQL on `notifications` |
| E-8 | One follow-up was notified **31 times — once daily for 31 consecutive days**, unread each time. | SQL, `group by related_id` |
| E-9 | Root cause: the dedupe unique index includes the date — `(user_id, type, related_id, dedupe_date)`. | `0013_notifications_engine.sql:20` |
| E-10 | Lifetime recommendation decisions: **11 generated, 1 approved, 0 dismissed.** | SQL on `ai_recommendations` |
| E-11 | Last AI usage: **2026-07-17** — 21 days ago. | SQL on `ai_usage` |
| E-12 | **15 of 47 tables have never received a row.** | `list_tables` row counts |
| E-13 | `revenue/page.tsx` still sums `leads.estimated_value`, but the label is now *"Won deal value (estimated)"* with the disclaimer *"not invoiced or collected"*. Rule R24 carries the same caveat. | `RevenueView.tsx:56,64,67`; `recommend.ts:427-465` |
| E-14 | Application-layer authorization **is** now enforced, with a regression guard that fails if a new action omits it. | `tests/unit.test.ts:2481` |
| E-15 | 4 users have signed in (not 2); most recent sign-in **2026-08-07 03:19 UTC**. | SQL on `auth.users` |

### Reported — asserted by existing artefacts, not independently confirmed

- Netlify auto-deploy from `main` is broken (`docs/14`, E4.2).
- The two sign-ins on file were builders rather than customers (`docs/13`).

### Unknown

- Whether the 2026-08-07 03:19 sign-in (E-15) was a human operator, the founder, or an
  automated harness. **This distinction decides whether the main constraint is unchanged.**
- Why `moorebi` exists (§9).
- Whether MOORE the consultancy has live service clients who are not in the product.

## 4. Findings

### 4.1 Three standing claims are wrong

| Claim | Source | Actual | Direction |
|---|---|---|---|
| "14 tables… MVP built" | Notion Cycle 1 memory | 47 tables, ~125 cycles | Stale by ~124 cycles |
| "43 tables" | `docs/37-known-risks.md` | 47 | Stale by 4 |
| **C-002 "Revenue is estimate-derived" — CONFIRMED open** | `docs/14-constraint-log.md` | **Repaired.** Relabelled *"Won deal value (estimated)"* with an explicit not-cash disclaimer; rule R24 carries the caveat too. | **Stale-pessimistic** |
| "2 users ever signed in; 21 days idle" | `docs/13-business-stage.md` | 4 users; last sign-in today | Stale-pessimistic |

`docs/14` and `docs/37` were written the same day and **contradict each other** on R-03/C-002.
`docs/37`'s closure table is correct; `docs/14`'s C-002 entry is not. Recorded as a
correction in §10.

**This matters beyond bookkeeping.** The programme's own diagnosis of its main constraint
rests on an evidence ledger that has drifted from the system in under 24 hours. An
operating-intelligence product that cannot keep its own institutional memory accurate for
one day has not yet demonstrated the capability it sells.

### 4.2 New defect R-19 — the notification engine is a running noise generator (S1)

**Confirmed, and it is live right now.**

The dedupe index keys on `dedupe_date` (E-9), so it suppresses only *same-day* duplicates.
Any item that stays overdue re-notifies **every day, indefinitely** — no ceiling, no decay,
no suppression when prior alerts are unread. One demo follow-up has fired 31 days running
(E-8). All 1,115 notifications are unread (E-7).

**Mechanism into failure:** a founder onboards by importing a real book — say 300 leads,
80 with overdue follow-ups. Day 1: ~80 notifications. Day 2: the same 80 again, plus
escalations. Within a week the notification surface is unreadable, and the operator stops
looking at the one channel through which MOORE delivers its value. The product's entire
proposition is *"see what needs action"*; this defect guarantees that channel is noise
before the first week ends.

This is not hypothetical degradation — it is the *observed* steady state. The system has
been doing it for 31 consecutive days against demo data.

### 4.3 New defect R-20 — the two security suites have never run in CI (S1 process)

The tenant-isolation suite and the prompt-injection suite self-skip without live secrets
(E-5), and CI provides only placeholders (E-6). Every green check in this repository's
history is **221 pure-unit tests**. The suites that protect tenant data and AI safety have
never gated a merge.

The Notion claim *"tenant isolation proven on all 14 tables"* therefore rests on a manual
local run against a schema that has since grown to 47 tables. RLS **is** enabled on all 47
(E-2) and the policy pattern is sound — but "enabled" is not "proven isolating", and the
mechanism that would prove it is switched off. R-07's guard test (E-14) shows the team
knows how to build an enforcing gate; this one was left ungated.

### 4.4 The build has crossed its own Stop List

`docs/16-stop-list.md` prohibits "commerce and inventory complexity" in early phases.
Shipped anyway: `suppliers`, `inventory_items`, `purchase_orders`, `stock_movements`, plus
migrations `0028_supply_chain`, `0032_stock_movements`, `0033_inventory_valuation`.

**All four tables have 0 rows** (E-12). So do 11 others. One third of the schema has never
held data. This is the §13 asymmetry made concrete: capability was added against a map, not
against an observed user need, and the Stop List did not stop it.

### 4.5 What is genuinely sound

Stated plainly, because an audit that only reports faults is not honest:

- Migration discipline is **excellent** — 43 versions, no gaps, repo and DB in step (E-3).
- RLS is on for all 47 tables with a consistent `get_user_client_ids()` / `can_write_client()`
  pattern (E-2).
- The R-01…R-06 repairs from C111 are **real**, each with a regression guard (E-13, E-14).
- The application-layer authorization hole (R-07) is closed and *cannot silently reopen* —
  the guard test fails if a new action omits `assertMember` (E-14).
- The evidence-discipline culture is real: R24's user-facing text now volunteers its own
  limitation ("These are deal values estimated at capture, not cash").

The engineering here is careful. That is precisely why engineering is not the constraint.

## 5. Mechanism

The programme is in a **closed loop with no error signal**.

1. Capability is selected from the capability map, not from observed user failure.
2. No operator uses the system, so no capability can be falsified — nothing is ever removed.
3. Additions compound: 47 tables, 48 routes, ~125 cycles, 15 tables that have never held a row.
4. Subsystems awaiting user input stay inert: 0 dismissals lifetime (E-10), AI idle 21 days (E-11).
5. Meanwhile the automated subsystems that *do* run without a user — the notification cron —
   accumulate unread output for a month (E-7), degrading the product for the first operator
   who eventually arrives.

Build velocity is high. **Learning velocity is zero.** The system cannot converge because
it receives no correction, and it is actively getting *worse* for its first user while it waits.

## 6. Counter-explanation

The prior cycle's alternatives A–D (`docs/14`) remain live. My evidence updates two:

- **(C) "Trust in the numbers" is now weaker.** The specific defect it named is repaired
  (E-13). C-002 should be downgraded from CONFIRMED to CLOSED.
- **A new candidate, E: the constraint is that nobody has been *asked*.** No customer
  interviews exist. Zero. Under the Mom Test the programme has never run a single switch
  interview — so "there is no demand" and "demand was never tested" are indistinguishable
  on current evidence. These require different responses: the first says stop, the second
  says go and ask. **The distinguishing test is five conversations, and it costs nothing
  but the founder's afternoon.**
- **E-15 could refute C-001 outright.** If today's sign-in was a real external operator,
  the constraint statement is out of date. One question to the founder settles it.

I am not able to distinguish these from the repository. They are founder questions, and
they are listed in §9.

## 7. Risks

- The 03:19 sign-in may be my own tooling or the prior cycle — treating it as adoption
  would be exactly the "activity as proof of progress" error the directive forbids. Held as Unknown.
- Netlify/PostHog/n8n were not inspected; a deploy or analytics fault could change the
  picture on time-to-first-value.
- If `moorebi` is *not* the intended new home, this document has itself forked the record —
  which is why it is one file that defers to `MOORE/docs/`, not a copy of the artefact set.

## 8. Recommendation — **REPAIR**

Two S1 defects, both on the critical path to surviving first operator contact. Nothing else.

**R-19 — cap the notification engine.** Drop `dedupe_date` from the dedupe key or add a
re-notification ceiling with decay; suppress when prior alerts are unread; collapse repeats
into a digest. *Smallest coherent change: one migration + one guard test.*

**R-20 — make the security suites run.** Add `SEED_DEMO_PASSWORD` (and, if AI safety is to
be gated, `ANTHROPIC_API_KEY`) as CI secrets, and make the RLS suite **fail** rather than
skip when they are absent, so the gate can never silently disappear again.

**Everything else: DELAY.** No new capability. Per Principle 16, at pre-validation the only
justified spend reduces demand uncertainty — and the cheapest such spend is not code at all.

### Why not STOP, and why not BUILD

Not **STOP**: the asset is real and well-engineered, and the demand question has never
actually been asked (§6, alternative E). Stopping now would discard a sound system on the
strength of a test never run.

Not **BUILD**: no new capability can be justified while 15 tables sit empty and the
learning loop has received one signal in its lifetime.

**REPAIR is deliberately narrow.** Both items are defect removal on the path to the first
pilot, not capability. Neither is worth doing if the answer to §9 is "the product is a
demo" — which is why the founder questions come first.

### Required test (lowest cost, highest information)

**Five switch interviews with founder-led service businesses, run by the founder, before
any further code.** Not a demo. Ask what they did last time cash slipped, what it cost, and
what they used instead. This is the only test that distinguishes §6's alternatives, and it
costs one afternoon against ~125 cycles of accumulated build.

### Acceptance criteria

| Item | Observable result |
|---|---|
| R-19 | No item generates more than N notifications without a state change; a test asserts a 31-day-overdue item produces ≤N, not 31. |
| R-20 | CI shows RLS + injection suites **executed**, not skipped; removing the secret turns CI red. |
| Test | 5 interview records committed, each naming a current alternative and a quantified cost of the problem. |
| Stage exit | Unchanged from `docs/13` — the four-part pilot criterion still governs. |

### Confidence

**High** on the audit findings — E-1…E-14 are direct execution or query, reproducible.
**Medium** on the constraint diagnosis — it depends on E-15, which is Unknown, and on
alternative E, which no evidence in the repository can settle.

## 9. Human review required — three founder questions

These block the next cycle. Everything safe and reversible is already done.

1. **Which repository is the home of MOORE BI?** `moorebi` is empty; the programme lives in
   `MOORE`. My branch was assigned here. Until this is answered I will not author code or
   canonical artefacts in `moorebi`, because that forks the source of truth — the failure
   already visible in the stale Notion memory.
2. **Was the 2026-08-07 03:19 sign-in a real external operator?** If yes, the main
   constraint statement is out of date and the next cycle changes entirely.
3. **Is MOORE BI intended for external users now, or is it a demo asset for investors and
   prospects?** If it is a demo, R-19 still matters (a demo with 1,115 unread alerts
   demonstrates badly) but the pilot framing and most of the 24 rules are surplus.

Also requiring the project owner, unchanged from `docs/37`: **R-11**, leaked-password
protection is still disabled — a Supabase dashboard toggle no migration can set.

## 10. Corrections to canonical artefacts

To be applied in `vibecreators/MOORE`, which remains the source of truth:

| File | Correction |
|---|---|
| `docs/14-constraint-log.md` | **C-002 → CLOSED.** Repaired; contradicts `docs/37`'s correct closure table. |
| `docs/13-business-stage.md` | E1.2 → 4 users, not 2. E1.4 → last sign-in 2026-08-07, not 21 days ago. Stage assessment (pre-validation) **unchanged** — 1 approval and 0 dismissals lifetime still fix it. |
| `docs/37-known-risks.md` | 43 → **47 tables**. Add **R-19** (S1) and **R-20** (S1). |
| `docs/16-stop-list.md` | Record the breach: supply-chain/inventory shipped against the Stop List, 0 rows. |
| Notion *Build Loop Memory (Cycle 1)* | Superseded — 14 tables → 47, Cycle 1 → ~125. Retire or date-stamp it. |

## 11. Files affected

Created here: `README.md`, `docs/00-phase-0-audit.md`.
**No application code was written.** Phase 0 forbids it, and the Build-Readiness Gate has
not passed — it is awaiting the answers in §9.

---

## Status report

- **Current objective:** establish the true state of MOORE BI and produce a defensible first decision.
- **Business stage:** PRE-VALIDATION (unchanged; `docs/13` stands, with corrected figures).
- **Main constraint:** C-001 — no real operator on a weekly rhythm. **STRONG HYPOTHESIS**,
  now with a new competing explanation (§6-E: demand was never tested) and one open fact (E-15).
- **Evidence gathered:** 15 confirmed findings; 3 standing claims corrected; 2 new S1 defects.
- **Work completed:** full repository, database, migration, test and advisor audit; independent
  re-verification of the standing risk register.
- **Agents used:** none. The work was bounded, sequential and evidence-gathering; spawning
  specialist agents would have re-derived context I already held. Registry unchanged.
- **Decisions made:** REPAIR (2 items) · DELAY (all new capability) · escalate 3 questions.
- **Material dissent preserved:** `docs/14` and `docs/37` contradict each other on C-002/R-03.
  Resolved in favour of `docs/37` **by direct code inspection**, not by preferring a source.
- **Risks discovered:** R-19 (notification flood, live), R-20 (security suites never gated).
- **Tests:** 221 passed, 0 failed, **8 skipped — and the 8 are the ones that matter.**
- **Business outcome:** none claimed. Nothing shipped to a user this cycle.
- **Primary next decision:** answer §9.1 — which repository is home.
- **Next smallest action:** founder answers three questions; then R-19's single migration.
- **Human approval required:** all three §9 questions, plus R-11.
