# 18 — Product Roadmap & Phase 1 Release Definition

## Phase sequence

| Phase | Name | Builds | Success condition |
|---|---|---|---|
| **1** | **Operating Control** | Entity, customers, pipeline, follow-ups, commitments, receivables & collections, decisions, weekly review, executive briefing, audit trail | One guided operator runs a complete weekly rhythm and finds measurable cash or execution leakage |
| 2 | Diagnostic Core | Objectives, signals, issues, hypotheses, counterevidence, Four Critical Factors, constraint engine, interventions, outcome review | A reviewable diagnosis connecting evidence → mechanism → decision → intervention → outcome |
| 3 | Institutional Memory | SOPs, authoritative records, meeting→decision capture, role & authority map, timeline, lineage, retrieval | The business explains why a decision was made without depending on one person |
| 4 | Whole-Entity Intelligence | Business Graph, causal maps, cross-functional diagnosis, founder-dependence, continuity architecture, Road Test | Reasoning across sales, cash, delivery, roles and risk without reducing the company to departments |
| 5 | Advanced Intelligence | Benchmarking, scenario simulation, predictive signals, digital twin, specialized agents, portfolio | Advanced features beat simpler baselines at acceptable cost and risk |

**Gate between every phase:** the previous phase's success condition is met **with evidence
from a real operator**, not a demo.

## Phase 1 — release definition

**One measurable objective:** a founder-led service business runs one full weekly operating
cycle in MOORE OS and identifies at least one quantified leak — overdue cash, a stalled
opportunity, or a missed commitment — that they had not already written down elsewhere.

### In scope

| Capability | User job | Product test |
|---|---|---|
| Entity setup | Define the business boundary before anything is diagnosed | 1, 3 |
| Customers & contacts | Know who we serve and who owes us | 1 |
| Pipeline | See opportunities and what each one is waiting on | 1, 6 |
| Follow-up engine | Never lose an opportunity to silence | 6, 7 |
| Commitments | One accountable owner, a date, completion evidence | 5, 6 |
| Invoices & payments | **Invoiced and collected shown separately, always** | 1, 7 |
| Receivables & ageing | See what is stuck and who owns getting it | 1, 3, 7 |
| Decision records | Preserve what was decided, by whose authority, and why | 4, 5, 9 |
| Weekly review | The habitual centre — the eleven questions | 1, 4, 6, 9 |
| Executive briefing | Open on decisions and exceptions, not charts | 1, 3, 4 |
| Audit trail | Every write attributable | 5, 7 |

### Explicitly excluded from Phase 1

Diagnostics, constraint engine, Business Graph, opportunity Road Test, SOP library, capacity,
quality, suppliers, projects, people/HR, risk register, governance, automations beyond
follow-up reminders, integrations beyond CSV import, Copilot beyond a single
evidence-grounded briefing summarizer.

**Notification rule (predecessor lesson).** An item may not re-notify indefinitely.
Re-notification requires a state change or an escalation step with a hard ceiling.
The predecessor notified one item **31 days running, unread every time**; a test asserts a
31-day-overdue item produces at most the ceiling.

### Acceptance criteria

1. Two tenants, zero cross-tenant reads — proven by a CI suite that **fails when it cannot run**.
2. Invoiced and collected are separately displayed and independently correct against a fixture.
3. No screen labels an estimate as revenue.
4. Weekly review produces owned commitments with dates.
5. A decision record captures authority, alternatives, expected mechanism and review date.
6. Every AI output carries evidence status and confidence, or it is not shown.
7. Time from empty account to first populated weekly review is under 30 minutes with CSV import.

### Definition of done

Merged code is not done. Done is: the intended user can use it · the workflow is
understandable · data and permissions are correct · it produces the intended operating output ·
monitoring exists · support procedures exist · the outcome is measurable · **pilot evidence
supports keeping it** · learning is recorded · no critical risk is unresolved.
