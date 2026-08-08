# 20 — Domain Model (Canonical Ontology)

MOORE OS is built around a business ontology, not around pages. Every table maps to an
object below; a proposed table that maps to none is rejected at the architecture gate.

## The seventeen objects

| # | Object | Definition | Phase |
|---|---|---|---|
| 1 | **Entity** | The company/unit/branch being managed — boundary, ownership, model, authority, obligations, dependencies. **Boundary comes first**: the same visible problem may belong to a parent, a product or the founder, not the unit being blamed. | 1 |
| 2 | **Stakeholder** | Anyone who receives value, supplies resources, carries risk, exercises authority or influences continuity. | 1 (minimal) |
| 3 | **Value proposition** | What result is promised to whom — recipient, need, promised result, current alternative, completion condition, willingness to pay, evidence value was realized. | 2 |
| 4 | **Objective** | A defined result for a defined entity and period. | 1 |
| 5 | **Opportunity** | A new product, market, client, investment, partnership or initiative. | 4 |
| 6 | **Business stage** | Proof state: Idea → Proving the problem → Proving the solution → Scale Zero → Scale One. Early spend funds learning; later spend funds repeatability. **Capital must not hide weak proof.** | 2 |
| 7 | **Signal** | An event, metric change or exception that may require attention. | 1 |
| 8 | **Issue** | A condition requiring investigation or action. | 2 |
| 9 | **Hypothesis** | A proposed explanation — with counterevidence, confidence, alternatives, and the test that distinguishes them. | 2 |
| 10 | **Constraint** | The condition currently limiting an objective. States: candidate · strong hypothesis · paired conditions · confirmed · unknown. **A causal hypothesis, never a checklist score.** | 2 |
| 11 | **Decision** | A choice authorized in response to an opportunity, issue, risk or constraint. Categories: Keep · Build · Repair · Redesign · Delay · Stop. | 1 |
| 12 | **Intervention** | The actual change made to the business. | 2 |
| 13 | **Commitment** | A promise by a person to deliver an outcome by a time, with completion evidence. | 1 |
| 14 | **Flow** | Movement of value or work from input to output. | 3 |
| 15 | **Artefact** | An authoritative record: contract, proposal, invoice, policy, SOP, decision record. | 3 |
| 16 | **Outcome** | What reality produced after a decision or intervention. | 2 |
| 17 | **Learning** | A conclusion that should change future behaviour. | 3 |

## Phase 1 tables

Operating objects, tenant-scoped by `entity_id`:

`organizations` · `profiles` · `entities` · `memberships` · `stakeholders` · `customers` ·
`contacts` · `opportunities` · `follow_ups` · `commitments` · `invoices` · `payments` ·
`objectives` · `signals` · `decisions` · `weekly_reviews` · `events` · `audit_log` · `ai_usage`

## Invariants enforced in the schema, not the UI

**Money.** `invoices` carries `amount` and status; **collected cash lives only in `payments`**.
There is no `paid` boolean and no nullable `paid_at` to forget — a sum over `payments` is the
only way to compute collected cash, so the predecessor's R-02 defect (imported "paid" invoices
reading ₦0 collected) is structurally impossible.

**Estimates.** `opportunities.estimated_value` is named for what it is and is **never**
labelled revenue. Reconciliation to cash runs `opportunity → invoice → payment`; the link
columns are `not null` where the chain must hold.

**Evidence status.** Every derived or asserted claim carries `evidence_status` from a Postgres
enum, defaulting to `unknown`. There is no path that writes a fact without one.

**Authority.** `memberships.role` plus explicit approval columns on anything material. AI
writes land in a proposal state and require a human transition.

**Tenancy.** Every business table has `entity_id not null` and RLS keyed to membership. No
table is exempt.

## Naming rules

Singular concepts, plural tables · `*_at` for timestamps · `*_status` for enums ·
money in minor units as `bigint` with an explicit `currency` · no boolean where a state
machine is meant · no column named `value` without a unit.
