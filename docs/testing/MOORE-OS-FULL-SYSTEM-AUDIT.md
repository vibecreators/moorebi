# MOORE OS — Full System Audit

**Date:** 2026-08-08 · **Commit:** `92b3e44` · **Target:** `vibecreators/moorebi` + Supabase `moore-os`

> **Auditor independence — disclosed.** I built this system. That is a real conflict and no
> disclaimer removes it. Everything below is therefore stated as a reproducible test with its
> query and result, so the findings can be checked without trusting the auditor. Three of the
> defects reported here are defects in my own work, found by executing tests rather than by
> reading code.

---

# Executive verdict

## **FAIL**

Not *unsafe* — no cross-tenant leakage, no data loss, no privilege escalation was found across
32 isolation probes. The engineering that exists is sound and, in places, unusually disciplined.

It fails on the standard set in §65 of the audit brief: *can a real business become measurably
better at seeing reality, controlling cash, diagnosing problems, making decisions, executing
them and learning from results because MOORE OS exists?*

**No — because no business can put anything into it.**

The decisive measurement:

```
Write operations in the entire application:  0
AI references in the entire application:     0
```

There are no forms, no server actions, no mutations. Every one of the nine screens is
read-only. Atlas Projects Ltd could not record a single invoice, log one decision, or close
one commitment. Roughly 45 of the 60 capability tests in the brief are **not failed — they are
untestable**, because the capability does not exist to test.

Reporting a percentage score here would be the exact failure the brief warns about: averaging
away a missing condition. The missing condition is *data entry*.

---

# Core product promise — did the loop work?

**Partially, and the distinction matters more than either half.**

I reconstructed the complete chain for the seeded business in a single query:

| Link | Value | Present |
|---|---|---|
| Issue | "Cash keeps running short despite a full order book" | ✅ |
| Rival hypotheses | **3**, each with counter-evidence and a distinguishing test | ✅ |
| Constraint | "Collection is unowned and unscheduled…" · `strong_hypothesis` | ✅ |
| Decision | "Assign collection ownership…" · `repair` · **authorised** | ✅ |
| Dissent preserved | true | ✅ |
| Intervention | "Collections owner assigned; Tuesday cadence…" | ✅ |
| Outcome | `partially_confirmed` | ✅ |
| Learnings | 2 linked | ✅ |

**The data model genuinely supports the loop.** That is not nothing — it is the hard part, and
most products that claim this cannot do it.

**But the product does not expose it.** I traversed that chain by writing SQL. No screen, query
interface or assistant in MOORE OS can answer *"why did we change our credit policy and did it
work?"*. `/remember` renders a flat event timeline; it does not reconstruct the chain. Per §45,
the closed-loop test is the one that decides the product promise, and the product half fails it.

---

# Critical failures

## P1 — Core operating loop cannot be run

| # | Finding | Evidence |
|---|---|---|
| **P1-1** | **The application is entirely read-only.** No create, update or delete anywhere. | `grep -rn "\.insert(\|\.update(\|\.delete(\|use server" src/` → **0** |
| **P1-2** | **No AI exists.** No Copilot, no modes, no evaluation harness. Tests U, V, W, X, Y are vacuous. | `grep -rln "anthropic\|openai" src/` → **0**. `ai_usage` table: **0 rows** |
| **P1-3** | **Contracted and booked revenue cannot be represented.** The brief requires Contracted ≠ Booked ≠ Invoiced ≠ Collected. Only the last two exist. | Columns matching `%contract%`: **0**. Matching `%book%`: **0** |
| **P1-4** | **The audit trail has never recorded anything.** `audit_log` exists with correct RLS and zero writers. | `audit_log`: **0 rows**; no insert path in `src/` |
| **P1-5** | **No closed-loop retrieval in-product** (see above). | No search, no query UI, no assistant |

## P1 — Financial integrity defects (P0 the moment a write path ships)

Both were found by adversarial insertion, and both silently corrupt collected cash — the number
the entire product is organised around.

| # | Finding | Test result |
|---|---|---|
| **P1-6** | **Overpayment accepted.** A ₦9,999,999.99 payment against a ₦23m invoice was accepted, producing negative outstanding and inflated collected cash. Nothing constrains `sum(payments) <= invoice.amount`. | `FAIL - accepted` |
| **P1-7** | **Currency mismatch accepted silently.** A **USD** payment was recorded against an **NGN** invoice and summed into collected cash. `money.ts` refuses to mix currencies; the database happily stores the mix. The guard is in the wrong layer. | `FAIL - accepted silently` |

P1-7 is the most instructive failure in this audit. `totalIn()` in `src/lib/money.ts` throws
rather than add naira to dollars, and there is a passing unit test proving it. That test gave
false assurance: the invariant was enforced in a pure function that nothing in the write path
calls, while the database — the only thing that actually gates writes — had no such rule.
**A green unit test suite certified an invariant the system does not hold.**

## Missing domain objects — entire capability areas absent

Queried directly: `contracts`, `bookings`, `projects`, `risks`, `documents`, `sops`, `roles`
→ **0 of 7 exist.**

Consequently untestable: project economics (F), delivery flow (G), people & roles (N), founder
dependence (O), knowledge hub (P), five-minute retrieval (Q), risk & continuity (S), automation
(T), opportunity road test (L), business stage (M), integrations (36), backup/restore (38),
operator console (53), simulation (48).

---

# What genuinely works

Stated plainly, because an audit that only reports faults is not an audit.

## Tenant isolation — 32/32 probes, zero leakage

Two tenants (Atlas Projects, Nova Advisory) with sensitive records. As the Atlas user I attempted
to read Nova data across **23 tables**, the settlement **view**, by **known primary key**, by
**known business identifier** (invoice number, customer name, decision title, evidence claim),
and through **cross-table joins**. Every probe returned zero rows.

Earlier in the build this was **not** true: `invoice_settlement` executed with its owner's rights
and bypassed RLS entirely. RLS was enabled on every table the whole time and did not prevent it.
That is a general lesson: *a tenancy audit that counts `rowsecurity` flags will miss view-layer
holes.*

## Invariants enforced in the database, not by convention

Seven of nine adversarial insertions were correctly rejected:

| Attempted | Result |
|---|---|
| Duplicate invoice number | **PASS** — blocked |
| Negative invoice amount | **PASS** — blocked |
| Due date before issue date | **PASS** — blocked |
| Commitment marked "met" with no completion evidence | **PASS** — blocked |
| Constraint marked "confirmed" with no mechanism | **PASS** — blocked |
| Opportunity marked "won" with no won date | **PASS** — blocked |
| Follow-up escalation beyond ceiling | **PASS** — blocked |

The authority invariant is real: while seeding this very audit, an attempt to insert an
`approved` decision with no named authority was **rejected by the database**. The system refused
to let its auditor create an unauthorised approval.

## Receivables ageing reconciles exactly

Atlas engineered to the brief's figures, computed independently from `invoices` + `payments`:

| Bucket | Required | Computed |
|---|---|---|
| 0–30 | ₦23,000,000 | **₦23,000,000** |
| 31–60 | ₦19,000,000 | **₦19,000,000** |
| 61–90 | ₦17,000,000 | **₦17,000,000** |
| 90+ | ₦15,000,000 | **₦15,000,000** |
| **Total** | **₦74,000,000** | **₦74,000,000** |

## Invoiced ≠ collected holds structurally

There is no `paid` flag and no nullable `paid_at`. Collected cash is a sum over `payments` and
cannot be computed any other way, so the predecessor's defect — imported "paid" invoices reading
₦0 collected and triggering a phantom cash crisis — is not expressible.

## Cross-domain graph traversal works

"Which customers are high-value, slow-paying and overdue?" resolved in one query across
customers → invoices → payments → stakeholders, no manual reconciliation:

- Bellamy Telecom — ₦9.1m invoiced, **₦0 collected**, ₦9.1m overdue, 60-day terms
- Ndu Agency — ₦6.8m invoiced, ₦2m collected, ₦4.8m overdue, 45-day terms

---

# Capability matrix

Status: **PRESENT** · **PARTIAL** · **MISSING** · **UNKNOWN**. No percentage is given, by design.

| Capability | Impl? | Functional? | Integrated? | Secure? | Evidence-grounded? | Auditable? | Status | Sev |
|---|---|---|---|---|---|---|---|---|
| Entity & boundary | Y | Read-only | Y | Y | Y | N | PARTIAL | P1 |
| Executive briefing | Y | Read-only | Y | Y | Y | N | PARTIAL | P2 |
| Sales / pipeline | Schema | No writes | Y | Y | Y | N | PARTIAL | P1 |
| Customer reality | Schema | No writes | Partial | Y | Y | N | PARTIAL | P2 |
| Receivables & cash | Y | Correct maths | Y | Y | Y | N | PARTIAL | P1 |
| Contracted / booked revenue | **N** | — | — | — | — | — | **MISSING** | **P1** |
| Project economics | **N** | — | — | — | — | — | **MISSING** | P1 |
| Delivery flow / WIP | **N** | — | — | — | — | — | **MISSING** | P1 |
| Constraint engine | Schema only | Manual | Y | Y | Y | N | PARTIAL | P1 |
| Four critical factors | Enum + display | No classifier | Y | Y | Y | N | PARTIAL | P2 |
| Hypothesis reasoning | Schema + UI | Manual | Y | Y | Y | N | PARTIAL | P2 |
| Decision hub | Y | Read-only | Y | Y | Y | N | PARTIAL | P1 |
| Opportunity road test | **N** | — | — | — | — | — | **MISSING** | P2 |
| Business stage | **N** | — | — | — | — | — | **MISSING** | P2 |
| People, roles, authority | Enum only | — | — | Y | — | N | **MISSING** | P1 |
| Founder dependence | **N** | — | — | — | — | — | **MISSING** | P2 |
| Knowledge / records | **N** | — | — | — | — | — | **MISSING** | P1 |
| Weekly review | Y | Read-only | Y | Y | Y | N | PARTIAL | P1 |
| Risk & continuity | **N** | — | — | — | — | — | **MISSING** | P1 |
| Automation engine | **N** | — | — | — | — | — | **MISSING** | P2 |
| MOORE Copilot (all modes) | **N** | — | — | — | — | — | **MISSING** | **P1** |
| AI evaluations | **N** | — | — | — | — | — | **MISSING** | P1 |
| Integrations | **N** | — | — | — | — | — | **MISSING** | P2 |
| Tenant isolation | Y | **Proven** | Y | **Y** | Y | Partial | **PRESENT** | — |
| RBAC | Roles exist | Not enforced beyond write/read | Partial | Partial | — | N | PARTIAL | P1 |
| Audit trail | Table only | **No writer** | N | Y | — | **N** | **MISSING** | **P1** |
| Event history | Y | Manual writes | Y | Y | Y | Partial | PARTIAL | P2 |
| Business graph | Implicit via FKs | Query-only | Y | Y | Y | N | PARTIAL | P2 |
| Reporting suite | **N** | — | — | — | — | — | **MISSING** | P2 |
| Backup / restore | **UNKNOWN** | Untested | — | — | — | — | **UNKNOWN** | P1 |
| Performance at scale | **UNKNOWN** | Untested | — | — | — | — | **UNKNOWN** | P2 |
| Mobile / accessibility | **UNKNOWN** | Untested | — | — | — | — | **UNKNOWN** | P3 |

---

# AI evaluation

**Not performed. There is no AI.**

The brief asks for 100 diagnostic questions measured on hallucination, citation, permission
compliance and cost against two baselines. Running that against a system with zero AI calls
would produce a document full of numbers and no information.

Recorded as **MISSING**, not as a failing score. When a Copilot exists, §31's evaluation must
run before it is shown to any user — and the §27 premise-challenge test ("prove the salespeople
are lazy") is the one I would gate release on.

---

# Financial integrity

| Check | Result |
|---|---|
| Ageing reconciliation (4 buckets, ₦74m) | **PASS** — exact |
| Invoiced ≠ collected, structurally | **PASS** |
| Duplicate invoice number | **PASS** — blocked |
| Negative amount | **PASS** — blocked |
| Impossible date ordering | **PASS** — blocked |
| Void invoice excluded from totals | **PASS** |
| Overdue depends on stated date, reproducible | **PASS** |
| **Overpayment beyond invoice** | **FAIL** |
| **Currency mismatch on payment** | **FAIL** |
| Contracted / booked representable | **FAIL** — not modelled |

---

# Security

- **Tenant isolation: PASS.** 32/32 probes, zero rows leaked, including via view, known ID,
  known business identifier and joins.
- **Supabase security advisor: 0 findings.**
- **Auth helpers not exposed as RPC** — moved to a non-API schema.
- **RBAC: PARTIAL.** `member_role` distinguishes read from write. There is no field-level
  restriction, so the brief's "Sales Rep must not see payroll" cannot be enforced — though
  payroll is not modelled either.
- **Audit: FAIL.** Nothing is logged. §34 is unsatisfiable today.

---

# False-confidence risks

Where MOORE OS currently appears smarter than its evidence supports:

1. **The nine-stage nav implies a working loop.** The screens are titled Observe → … → Remember
   and read as a system. A demo would be persuasive. Nothing behind them accepts input.
2. **Green CI certified an invariant the system does not hold** (P1-7). The currency guard lives
   in a pure function outside the write path.
3. **The seeded business is coherent because I wrote it that way.** The diagnostic chain reads
   impressively; no part of it was produced by the system. A viewer cannot tell authored content
   from derived content, and nothing on screen marks the difference.
4. **"RLS enabled on every table"** was true while the settlement view leaked. Do not accept that
   phrase as an isolation proof again.

---

# Main constraint on MOORE OS itself

Unchanged from the constraint log, and this audit strengthens it.

**The binding constraint is still the absence of one real operator — but the proximate blocker
has moved.** Even a willing pilot customer cannot use MOORE OS today, because there is no way to
enter data. The system can only display a business someone else has already recorded in SQL.

Next constraint predicted after write paths ship: **data entry burden**. A founder will not
hand-key 42 opportunities and 25,000 invoices. Import, or integration, decides whether the
weekly rhythm survives week two.

---

# Recommendation

## **BUILD** — narrowly, in this order

1. **Write paths for the Phase 1 loop** (P1-1). Server actions with `assertMember` guards for
   customers, invoices, payments, commitments, decisions, weekly review. Without this nothing
   else matters.
2. **Fix P1-6 and P1-7 in the database**, not in TypeScript. A `payments` trigger enforcing
   `sum(payments) <= invoice.amount` and `payments.currency = invoices.currency`. Add both to the
   invariant test suite — at the layer that actually gates writes.
3. **Give `audit_log` a writer** (P1-4). Every mutation, with actor, before and after.
4. **Model contracted and booked revenue** (P1-3), or explicitly descope the four-state
   distinction and say so in the charter. Do not leave the brief's central financial requirement
   half-implemented and unremarked.
5. **In-product closed-loop retrieval** (P1-5) — one screen answering "why did we decide X and
   did it work?" from the chain that already exists.

Only then: Copilot, automation, integrations.

## Required before any release

- P1-1, P1-6, P1-7, P1-4 closed.
- CI isolation gate green — **the four repository secrets still do not exist**, so the only
  automated tenancy proof has never run. Today's isolation evidence is a manual audit that
  nothing re-runs.
- One end-to-end run where a human enters real data and completes a weekly review.

## Required before scale

- AI evaluation harness with baselines, before any Copilot reaches a user.
- Backup **and tested restore** (currently UNKNOWN).
- Load test at the brief's volumes (currently UNKNOWN).
- RBAC field-level enforcement.
- Eight consecutive weekly cycles with a real operator, per §44.

---

# Final audit questions

| | Answer |
|---|---|
| **Reality** — does it represent the business? | Partially. Cash and pipeline yes; delivery, people, knowledge, risk not modelled. |
| **Value** — does it improve an outcome? | **Not yet demonstrable.** No user can operate it. |
| **Diagnosis** — symptoms from mechanisms? | The model distinguishes them well. Nothing automates the distinction. |
| **Constraint** — relative to an objective? | Schema supports it; no engine derives it. |
| **Decision** — improves judgment? | The record format is genuinely strong: alternatives, mechanism, must-protect, dissent. Read-only. |
| **Execution** — ownership and follow-through? | Commitments require evidence to close. Cannot be created in-product. |
| **Cash** — distinctions correct? | Invoiced/collected correct and structural. Contracted/booked absent. Two write-path defects. |
| **Memory** — reconstruct why? | In the database yes. In the product no. |
| **Learning** — does outcome update reasoning? | Recorded, linked, displayed. Nothing consumes it. |
| **AI** — judgment without false certainty? | **No AI exists.** |
| **Security** — data protected? | Yes, on the evidence: 32/32, advisor clean. Audit trail absent. |
| **Adoption** — can teams use it repeatedly? | **No.** Read-only. |
| **Economics** — sustainable cost? | Unknown. No AI spend yet; `ai_usage` metering is built and unused. |

---

**Verdict: FAIL.** The foundation is better than the product. What exists is well-built,
correctly isolated and honest about evidence. It is not yet an operating system, because an
operating system is something a business operates — and this one cannot be operated.
