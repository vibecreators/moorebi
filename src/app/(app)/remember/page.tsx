import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Tag, Empty, StageHeader, Evidence } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, "good" | "warn" | "bad" | "plain"> = {
  "payment.received": "good",
  "commitment.met": "good",
  "decision.approved": "warn",
  "intervention.started": "warn",
  "outcome.reviewed": "plain",
};

const CLASS_TONE = {
  confirmed: "good", partially_confirmed: "warn", inconclusive: "plain",
  rejected: "bad", harmful: "bad", not_used: "plain",
} as const;

/**
 * Closed-loop retrieval (audit finding P1-5).
 *
 * The audit could reconstruct issue → hypotheses → constraint → decision →
 * intervention → outcome → learning, but only by hand-writing SQL. The data
 * carried the chain; nothing in the product walked it, so "why did we decide
 * this, and did it work?" had no answer inside MOORE OS.
 *
 * This page answers exactly that question, per decision, by traversing the
 * links the schema already enforces.
 */
export default async function RememberPage() {
  const sb = supabaseServer();

  const [decisions, interventions, outcomes, learnings, constraints, issues, hypotheses, events] =
    await Promise.all([
      sb.from("decisions").select("*").order("created_at", { ascending: false }),
      sb.from("interventions").select("*"),
      sb.from("outcomes").select("*"),
      sb.from("learnings").select("*"),
      sb.from("constraints").select("*"),
      sb.from("issues").select("*"),
      sb.from("hypotheses").select("*"),
      sb.from("events").select("*").order("occurred_at", { ascending: false }).limit(30),
    ]);

  // Walk the chain outward from each decision.
  const chains = (decisions.data ?? []).map((d) => {
    const itvs = (interventions.data ?? []).filter((i) => i.decision_id === d.id);
    const ocs = (outcomes.data ?? []).filter(
      (o) => o.decision_id === d.id || itvs.some((i) => i.id === o.intervention_id),
    );
    const con = (constraints.data ?? []).find((c) => itvs.some((i) => i.constraint_id === c.id));
    const iss = con
      ? (issues.data ?? []).find((i) => i.objective_id === con.objective_id) ?? (issues.data ?? [])[0]
      : undefined;
    const hyps = iss ? (hypotheses.data ?? []).filter((h) => h.issue_id === iss.id) : [];
    const lrns = (learnings.data ?? []).filter((l) => ocs.some((o) => o.id === l.outcome_id));
    return { d, itvs, ocs, con, iss, hyps, lrns };
  });

  const Step = ({ n, label, children, missing }: {
    n: number; label: string; children?: React.ReactNode; missing?: string;
  }) => (
    <li className="relative pl-7">
      <span className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-edge bg-ink text-[10px] tabular-nums text-muted">
        {n}
      </span>
      <div className="text-[10px] uppercase tracking-wide text-accent">{label}</div>
      {children ?? <div className="mt-0.5 text-xs italic text-muted/60">{missing}</div>}
    </li>
  );

  return (
    <>
      <StageHeader stage="Remember" />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        The business memory. Not a chat log — the reconstructed reasoning behind each decision,
        so the answer to <em>why did we do that, and did it work?</em> does not depend on one
        person still working here.
      </p>

      {chains.length === 0 ? (
        <Empty what="No decisions on record." why="A decision recorded on Decide will appear here with its full chain." />
      ) : (
        <div className="space-y-4">
          {chains.map(({ d, itvs, ocs, con, iss, hyps, lrns }) => (
            <Panel key={d.id} title={d.title}
                   subtitle={d.approved_at
                     ? `Authorised ${new Date(d.approved_at).toISOString().slice(0, 10)}`
                     : "Not yet authorised"}>
              <ol className="space-y-4">
                <Step n={1} label="The problem that started it"
                      missing="No issue linked — this decision has no recorded origin.">
                  {iss && (
                    <>
                      <p className="mt-0.5 text-sm text-text">{iss.title}</p>
                      {iss.description && <p className="mt-1 text-xs leading-relaxed text-muted">{iss.description}</p>}
                    </>
                  )}
                </Step>

                <Step n={2} label={`What we considered — ${hyps.length} competing explanation${hyps.length === 1 ? "" : "s"}`}
                      missing="No hypotheses recorded — the cause was assumed, not tested.">
                  {hyps.length > 0 && (
                    <ul className="mt-1 space-y-1.5">
                      {hyps.map((h) => (
                        <li key={h.id} className="flex items-start justify-between gap-3">
                          <span className="text-xs leading-relaxed text-muted">{h.statement}</span>
                          <span className="flex shrink-0 gap-1">
                            <Evidence status={h.confidence} />
                            <Tag tone={h.status === "supported" ? "good" : h.status === "rejected" ? "bad" : "plain"}>
                              {h.status}
                            </Tag>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Step>

                <Step n={3} label="What we concluded was limiting us"
                      missing="No constraint linked.">
                  {con && (
                    <>
                      <p className="mt-0.5 text-sm text-text">{con.statement}</p>
                      <Tag tone={con.status === "confirmed" ? "bad" : "warn"}>{con.status.replace(/_/g, " ")}</Tag>
                    </>
                  )}
                </Step>

                <Step n={4} label="What we decided, and why it should work">
                  {d.recommendation && <p className="mt-0.5 text-sm text-text">{d.recommendation}</p>}
                  {d.expected_mechanism && (
                    <p className="mt-1.5 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                      <span className="text-accent">Expected mechanism · </span>{d.expected_mechanism}
                    </p>
                  )}
                  {d.alternatives && (
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted">
                      <span className="text-muted/70">Alternatives · </span>{d.alternatives}
                    </p>
                  )}
                  {d.dissent && (
                    <p className="mt-1.5 rounded border border-bad/40 bg-bad/5 px-2.5 py-1.5 text-xs leading-relaxed text-text">
                      <span className="text-bad">Dissent · </span>{d.dissent}
                    </p>
                  )}
                </Step>

                <Step n={5} label="What we actually did"
                      missing="Decided but never implemented — no intervention recorded.">
                  {itvs.length > 0 && (
                    <ul className="mt-0.5 space-y-1">
                      {itvs.map((i) => (
                        <li key={i.id} className="text-sm text-text">
                          {i.description}
                          <span className="ml-2 text-xs text-muted">started {i.started_on ?? "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Step>

                <Step n={6} label="What reality produced"
                      missing="Never reviewed. Until it is, this decision is an untested belief.">
                  {ocs.map((o) => (
                    <div key={o.id} className="mt-0.5">
                      <Tag tone={CLASS_TONE[o.classification as keyof typeof CLASS_TONE]}>
                        {o.classification.replace(/_/g, " ")}
                      </Tag>
                      <p className="mt-1.5 text-sm text-text">{o.actual}</p>
                      {o.expected && <p className="mt-1 text-xs text-muted">Expected: {o.expected}</p>}
                      {o.unintended && <p className="mt-1 text-xs text-warn">Unintended: {o.unintended}</p>}
                    </div>
                  ))}
                </Step>

                <Step n={7} label="What we will do differently"
                      missing="No learning recorded — the outcome has not changed anything yet.">
                  {lrns.length > 0 && (
                    <ul className="mt-0.5 space-y-1.5">
                      {lrns.map((l) => (
                        <li key={l.id} className="border-l-2 border-accent/50 pl-3 text-xs leading-relaxed text-text">
                          {l.statement}
                        </li>
                      ))}
                    </ul>
                  )}
                </Step>
              </ol>
            </Panel>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Panel title="Organizational timeline">
          {(events.data ?? []).length === 0 ? <Empty what="No events recorded." /> : (
            <ol className="relative space-y-3 border-l border-edge pl-6">
              {events.data!.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-edge ring-4 ring-ink" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone={KIND_TONE[e.kind] ?? "plain"}>{e.kind}</Tag>
                    <span className="text-xs text-muted">
                      {new Date(e.occurred_at).toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text">
                    {Object.entries(e.payload as Record<string, unknown>)
                      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                      .join(" · ") || "—"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
