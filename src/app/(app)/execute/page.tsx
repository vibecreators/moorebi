import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Tag, Empty, StageHeader, naira } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExecutePage() {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [interventions, commitments, opportunities, followUps] = await Promise.all([
    sb.from("interventions").select("*").order("started_on", { ascending: false }),
    sb.from("commitments").select("*").order("due_date"),
    sb.from("opportunities").select("*").not("stage", "in", "(won,lost)").order("next_action_due"),
    sb.from("follow_ups").select("*").is("completed_at", null).order("due_date"),
  ]);

  const commits = commitments.data ?? [];
  const met = commits.filter((c) => c.status === "met").length;

  return (
    <>
      <StageHeader stage="Execute" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Interventions" subtitle="What was actually changed — distinct from what was decided.">
          {(interventions.data ?? []).length === 0 ? <Empty what="No interventions started." /> : (
            <ul className="space-y-4">
              {interventions.data!.map((i) => (
                <li key={i.id} className="rounded-lg border border-edge bg-ink/40 p-4">
                  <p className="text-sm font-medium text-text">{i.description}</p>
                  {i.expected_mechanism && (
                    <p className="mt-2 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                      <span className="text-accent">Expected mechanism · </span>{i.expected_mechanism}
                    </p>
                  )}
                  {i.expected_result && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      <span className="text-text">Expected result · </span>{i.expected_result}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    Started {i.started_on ?? "—"}
                    {i.review_on && <> · review {i.review_on}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Commitments"
               subtitle="One accountable owner, a date, and evidence before anything counts as met."
               right={<span className="text-xs text-muted">{met}/{commits.length} met</span>}>
          {commits.length === 0 ? <Empty what="No commitments." /> : (
            <ul className="divide-y divide-edge">
              {commits.map((c) => {
                const overdue = c.status !== "met" && c.due_date < today;
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-sm ${c.status === "met" ? "text-muted line-through" : "text-text"}`}>
                        {c.promised_result}
                      </span>
                      <Tag tone={c.status === "met" ? "good" : overdue ? "bad" : c.status === "at_risk" ? "warn" : "plain"}>
                        {overdue ? "overdue" : c.status}
                      </Tag>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Due {c.due_date}
                      {c.completion_evidence && <> · {c.completion_evidence}</>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Pipeline" subtitle="Estimated values, labelled as estimates. Never summed as revenue.">
          {(opportunities.data ?? []).length === 0 ? <Empty what="No open opportunities." /> : (
            <ul className="divide-y divide-edge">
              {opportunities.data!.map((o) => (
                <li key={o.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-text">{o.title}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm tabular-nums text-muted">{naira(Number(o.estimated_value))}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-muted/70">estimated</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Tag>{o.stage}</Tag>
                    {o.next_action && (
                      <span className={`text-xs ${o.next_action_due && o.next_action_due < today ? "text-bad" : "text-muted"}`}>
                        {o.next_action} · {o.next_action_due}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups"
               subtitle="Escalation is capped. Nothing here can re-notify you forever.">
          {(followUps.data ?? []).length === 0 ? <Empty what="Nothing outstanding." /> : (
            <ul className="divide-y divide-edge">
              {followUps.data!.map((f) => (
                <li key={f.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-text">{f.note}</span>
                    <Tag tone={f.escalation_step >= 3 ? "bad" : f.escalation_step > 0 ? "warn" : "plain"}>
                      step {f.escalation_step}/3
                    </Tag>
                  </div>
                  <p className="mt-1 text-xs text-muted">Due {f.due_date}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted/70">
            Re-notification requires a state change and stops at step 3. Repeating the same alert
            daily does not increase urgency — it trains people to stop reading.
          </p>
        </Panel>
      </div>
    </>
  );
}
