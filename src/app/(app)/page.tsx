import Link from "next/link";
import { supabaseServer, requireEntity } from "@/lib/supabase/server";
import { Panel, Stat, Evidence, Tag, Empty, StageHeader, naira } from "@/components/ui";
import { ActionForm, Hidden } from "@/components/ActionForm";
import { acknowledgeSignal } from "@/app/actions/operate";

export const dynamic = "force-dynamic";

const SEVERITY_TONE = { critical: "bad", urgent: "bad", attention: "warn", info: "plain" } as const;

export default async function Briefing() {
  const sb = supabaseServer();
  const entity = await requireEntity();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const [signals, settlement, payments, decisions, commitments, constraintRow] = await Promise.all([
    sb.from("signals").select("*").is("acknowledged_at", null).order("severity").order("detected_on", { ascending: false }),
    sb.from("invoice_settlement").select("invoiced, collected, outstanding, is_overdue"),
    sb.from("payments").select("amount, received_on").gte("received_on", monthStart),
    sb.from("decisions").select("id, title, status, category, review_on").in("status", ["requested", "under_review"]),
    sb.from("commitments").select("id, promised_result, due_date, status").in("status", ["open", "at_risk"]).order("due_date"),
    sb.from("constraints").select("statement, status, mechanism, factor").neq("status", "rejected")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const rows = settlement.data ?? [];
  // Three different numbers, computed three different ways, shown separately.
  const invoiced = rows.reduce((s, r) => s + Number(r.invoiced), 0);
  const collectedAllTime = rows.reduce((s, r) => s + Number(r.collected), 0);
  const overdue = rows.filter((r) => r.is_overdue).reduce((s, r) => s + Number(r.outstanding), 0);
  const collectedThisMonth = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const overdueCommitments = (commitments.data ?? []).filter((c) => c.due_date < today);
  const constraint = constraintRow.data;

  return (
    <>
      <StageHeader stage="Observe" />

      <p className="mb-6 max-w-3xl text-[15px] leading-relaxed text-text">
        {(signals.data ?? []).length > 0 ? (
          <>
            <span className="text-muted">Good morning, Amaka.</span>{" "}
            {signals.data!.length} condition{signals.data!.length === 1 ? "" : "s"} require attention,
            and {naira(overdue)} is overdue.
          </>
        ) : (
          <span className="text-muted">Nothing requires attention today.</span>
        )}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected this month" value={naira(collectedThisMonth)} tone="good"
              note="Cash actually received, by the date it arrived." />
        <Stat label="Overdue" value={naira(overdue)} tone={overdue > 0 ? "bad" : "good"}
              note="Issued, past due, still unpaid." />
        <Stat label="Invoiced (all time)" value={naira(invoiced)}
              note="Billed. Not revenue, and not cash." />
        <Stat label="Collected (all time)" value={naira(collectedAllTime)}
              note={`${invoiced > 0 ? Math.round((collectedAllTime / invoiced) * 100) : 0}% of everything billed.`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="What changed" subtitle="Signals detected from the data, not typed in by anyone.">
            {(signals.data ?? []).length === 0 ? (
              <Empty what="No open signals." />
            ) : (
              <ul className="space-y-3">
                {signals.data!.map((s) => (
                  <li key={s.id} className="rounded-lg border border-edge bg-ink/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-text">{s.summary}</p>
                      <div className="flex shrink-0 gap-1.5">
                        <Tag tone={SEVERITY_TONE[s.severity as keyof typeof SEVERITY_TONE]}>{s.severity}</Tag>
                        <Evidence status={s.status} />
                      </div>
                    </div>
                    {s.detail && <p className="mt-2 text-sm leading-relaxed text-muted">{s.detail}</p>}
                    <div className="mt-2">
                      <ActionForm action={acknowledgeSignal} submitLabel="Acknowledge">
                        <Hidden name="entity_id" value={entity.id} />
                        <Hidden name="signal_id" value={s.id} />
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Commitments at risk"
                 subtitle="A promise with one accountable owner and a date."
                 right={<Link href="/execute" className="text-xs text-accent hover:underline">Execute →</Link>}>
            {(commitments.data ?? []).length === 0 ? (
              <Empty what="No open commitments." />
            ) : (
              <ul className="divide-y divide-edge">
                {commitments.data!.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-sm text-text">{c.promised_result}</span>
                    <span className="shrink-0">
                      <Tag tone={c.due_date < today ? "bad" : c.status === "at_risk" ? "warn" : "plain"}>
                        {c.due_date < today ? "overdue" : c.status} · {c.due_date}
                      </Tag>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {overdueCommitments.length > 0 && (
              <p className="mt-3 text-xs text-bad">
                {overdueCommitments.length} past its date. An unmet commitment is a signal about capacity, not a scolding.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Current constraint">
            {!constraint ? (
              <Empty what="No constraint identified yet." why="Diagnose an issue to open one." />
            ) : (
              <>
                <Tag tone={constraint.status === "confirmed" ? "bad" : "warn"}>
                  {constraint.status.replace(/_/g, " ")}
                </Tag>
                <p className="mt-3 text-sm leading-relaxed text-text">{constraint.statement}</p>
                {constraint.mechanism && (
                  <p className="mt-3 border-l-2 border-edge pl-3 text-xs leading-relaxed text-muted">
                    {constraint.mechanism}
                  </p>
                )}
                <Link href="/diagnose" className="mt-4 inline-block text-xs text-accent hover:underline">
                  See the diagnosis →
                </Link>
              </>
            )}
          </Panel>

          <Panel title="Decisions awaiting authority">
            {(decisions.data ?? []).length === 0 ? (
              <Empty what="Nothing waiting on a decision." />
            ) : (
              <ul className="space-y-2">
                {decisions.data!.map((d) => (
                  <li key={d.id} className="text-sm text-text">{d.title}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Boundary" subtitle="What this entity is, and is not.">
            <p className="text-xs leading-relaxed text-muted">{entity.boundary_note}</p>
            <Link href="/model" className="mt-3 inline-block text-xs text-accent hover:underline">
              Model →
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
