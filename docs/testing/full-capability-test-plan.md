# Full Capability Test Plan

Companion to [`MOORE-OS-FULL-SYSTEM-AUDIT.md`](./MOORE-OS-FULL-SYSTEM-AUDIT.md). Records what
was tested, what was skipped and **why**, so the audit's coverage can be challenged.

## Test model

| Layer | Method |
|---|---|
| Schema & invariants | Adversarial SQL insertion against the live project |
| Tenancy | Two seeded tenants, JWT impersonation via `set_config('request.jwt.claims', …)` |
| Financial maths | Fixtures reconciled by hand against the brief's figures |
| Application | Static inspection; the sandbox network policy blocks the Supabase host, so authenticated screens could not be driven |
| AI | **Not testable — no AI exists** |

## Fixtures created

| Tenant | Purpose | Notes |
|---|---|---|
| **Lumen Studios** | Demo business carrying a full diagnostic chain | Login `founder@moore.demo` |
| **Atlas Projects Ltd** | Receivables engineered to the brief's ageing figures | Audit fixture |
| **Nova Advisory Ltd** | Confidential records used as leakage bait | Audit fixture |

Atlas and Nova are retained deliberately so the isolation result stays reproducible. Neither is
visible to the demo account — that is itself part of the finding.

## Executed

| Brief § | Test | Result |
|---|---|---|
| 11 / E | Receivables ageing, four buckets, ₦74m | **PASS** — exact |
| 11 / E | Duplicate invoice control | **PASS** |
| 11 / E | Contracted ≠ Booked ≠ Invoiced ≠ Collected | **FAIL** — first two not modelled |
| 32 / Z | Cross-tenant leakage, 32 probes | **PASS** — zero |
| 34 | Audit trail | **FAIL** — no writer |
| 45 | Closed-loop reconstruction | **PARTIAL** — data yes, product no |
| 49 | Business graph traversal | **PASS** at query layer |
| 50 | Data quality, 9 adversarial inserts | **7 PASS / 2 FAIL** |
| 59 | Human authorisation on approvals | **PASS** — DB rejected an unauthorised approval |

## Not executed, and why

Skipped because the **capability is absent**, not because testing was inconvenient. Running them
would generate findings about nothing.

| Brief § | Area | Reason |
|---|---|---|
| 27–31 | Copilot, hallucination, counter-evidence, AI authority, evaluations | Zero AI in the codebase |
| 12, 13 | Project economics, delivery flow | No `projects` table |
| 20, 21 | Roles, authority, founder dependence | Only a `member_role` enum |
| 22, 23 | Knowledge hub, five-minute retrieval | No documents or SOPs |
| 25 | Risk & continuity | No `risks` table |
| 26 | Automation | No engine |
| 36 | Integrations | None |
| 38 | Backup & restore | Never attempted — **UNKNOWN**, and a release blocker |
| 39 | Performance at scale | Not run |
| 41, 42 | Mobile, accessibility | Not run — app is read-only, so workflows don't exist to test |
| 48, 52, 53, 54 | Simulation, verticals, operator console, self-serve onboarding | Not built |

## Known limits of this audit

1. **The auditor is the author.** Disclosed in the report. Mitigated by making every finding a
   reproducible query, not a judgement.
2. **No live UI testing.** The sandbox blocks `supabase.co`, so authenticated screens were never
   rendered. Everything about the application layer is from static inspection. **Any claim about
   how a screen behaves for a signed-in user is unverified.**
3. **No load testing**, so all performance rows are UNKNOWN rather than passing.
4. **Isolation evidence is manual.** The CI gate that would re-prove it on every commit has never
   run — the four repository secrets do not exist. A manual proof that nothing re-runs decays
   from the moment it is taken.
