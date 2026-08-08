# 00 — MOORE OS Product Charter

**Status:** Active · **Opened:** 2026-08-07 · **Supersedes:** the MOORE build in
`vibecreators/MOORE` (retired — see `docs/50-predecessor-retirement.md`).

## What MOORE OS is

The operating-intelligence layer for founder-led businesses. It sits **above and between**
the systems a business already runs, and carries it around one loop:

`OBSERVE → MODEL → VALIDATE → DIAGNOSE → DECIDE → EXECUTE → REVIEW → LEARN → REMEMBER`

Its deepest capability is not CRM, task management or AI chat. It is moving an organization
from data to information to knowledge to understanding to decision to action to outcome to
learning — and holding onto what it learned.

## What MOORE OS is not

Not a task manager · not a generic CRM · not an ERP · not a chatbot · not a business-plan
generator · not an accounting platform · not a no-code workspace · **not an autonomous CEO**.

## The product test

Every feature must answer **yes** to at least one. A feature answering none is not built.

1. Does it help the business see reality?
2. Does it establish what has actually been proved?
3. Does it reveal a material constraint?
4. Does it improve a decision?
5. Does it clarify ownership or authority?
6. Does it coordinate execution?
7. Does it protect cash, value or continuity?
8. Does it verify whether an intervention worked?
9. Does it preserve organizational learning?

## Non-negotiable invariants

These are correctness requirements, not preferences. Each has a test in
`docs/33-testing-strategy.md`; a build that violates one does not ship.

**Financial** — the system must never silently conflate: booked ≠ invoiced ≠ **collected**;
profit ≠ cash; contribution ≠ gross revenue; available ≠ restricted cash; budget ≠ commitment
≠ payment; forecast ≠ actual; customer interest ≠ customer demand; task completion ≠ outcome.

Every displayed figure must be able to state its source inputs, formula, currency, period,
assumptions, timestamp and data quality.

**Epistemic** — every claim carries an evidence status: Confirmed · Reported · Calculated ·
Inferred · Judgment · Assumption · **Unknown** · Contested. **Unknown is never rendered as
healthy**, and a health average may never conceal a missing dimension.

**Authority** — AI may retrieve, summarize, classify, draft and flag. AI must have human
approval before external communication, contract or price changes, credit, payments,
expenditure, personnel actions, permission changes, record deletion, legal/tax/regulatory
conclusions, or production deployment.

**Tenancy** — RLS on every table, membership-scoped, proven by a suite that runs in CI and
fails the build when it cannot run. *(Direct lesson from the predecessor: its isolation suite
silently self-skipped for its entire life.)*

## Users

Founder/CEO · GM/COO · Finance lead · Sales lead · Delivery lead · Team member ·
MOORE Operating Partner · Board/investor. **Different roles get different interfaces**, not
one dashboard with hidden tabs.

## Business stage — honest statement

**PRE-VALIDATION.** Carried forward from the predecessor audit and unchanged by the rebuild:
zero customer interviews on file, zero external operators, zero willingness-to-pay evidence.

The predecessor produced ~125 build cycles and no demand evidence. **That asymmetry is the
programme's defining risk and the rebuild does not fix it** — a new codebase is still supply.
The charter records this so no future cycle can mistake build progress for validation.

**Standing rule:** the first named external operator is worth more than any feature on the
capability map. See `docs/14-constraint-log.md`.

## Governing principles

Reality before opinion · boundary before diagnosis · customer value before features ·
evidence before recommendation · diagnosis before action · constraints before optimization ·
flow before departmental activity · **collected cash before reported revenue** · authority
with accountability · understanding before automation · human approval for material
decisions · learning before scaling · reversible tests before irreversible commitments ·
security before convenience · outcomes before output · stage determines spending ·
**do not scale a problem** · Unknown is not Present · founder rescue must be disclosed ·
every intervention produces a reviewable outcome.
