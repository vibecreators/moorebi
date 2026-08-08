import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Evidence, Tag, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const FACTORS: Record<string, { title: string; asks: string }> = {
  right_context:      { title: "Right Context",      asks: "Does the external environment permit the model to work?" },
  right_supply:       { title: "Right Supply",       asks: "Can the business correctly produce the intended result?" },
  adequate_resources: { title: "Adequate Resources", asks: "Is there enough usable capacity?" },
  internal_coherence: { title: "Internal Coherence", asks: "Do the parts reinforce the same intended result?" },
};

export default async function DiagnosePage() {
  const sb = supabaseServer();
  const [issues, hypotheses, constraints] = await Promise.all([
    sb.from("issues").select("*").order("opened_on", { ascending: false }),
    sb.from("hypotheses").select("*"),
    sb.from("constraints").select("*").order("created_at", { ascending: false }),
  ]);

  const hyps = hypotheses.data ?? [];

  return (
    <>
      <StageHeader stage="Diagnose" />

      {(issues.data ?? []).length === 0 ? (
        <Empty what="No issues under investigation." why="Issues are opened from signals on the Observe step." />
      ) : (
        <div className="space-y-6">
          {issues.data!.map((issue) => {
            const mine = hyps.filter((h) => h.issue_id === issue.id);
            return (
              <div key={issue.id}>
                <Panel
                  title={issue.title}
                  subtitle={issue.description ?? undefined}
                  right={<div className="flex gap-1.5"><Tag tone="bad">{issue.severity}</Tag><Tag>{issue.status}</Tag></div>}
                >
                  <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">
                    Competing explanations — {mine.length}
                  </h3>
                  <p className="mb-4 text-xs leading-relaxed text-muted">
                    Held side by side on purpose. A single explanation that arrives without rivals
                    has not been tested against anything.
                  </p>

                  <div className="space-y-3">
                    {mine.map((h) => (
                      <article key={h.id} className="rounded-lg border border-edge bg-ink/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-relaxed text-text">{h.statement}</p>
                          <div className="flex shrink-0 gap-1.5">
                            <Evidence status={h.confidence} />
                            <Tag tone={h.status === "supported" ? "good" : h.status === "rejected" ? "bad" : "warn"}>
                              {h.status}
                            </Tag>
                          </div>
                        </div>

                        {h.mechanism && (
                          <p className="mt-3 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                            <span className="text-accent">Mechanism · </span>{h.mechanism}
                          </p>
                        )}

                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-good">Supporting</dt>
                            <dd className="mt-0.5 text-xs leading-relaxed text-muted">
                              {h.supporting_evidence || "None recorded."}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-bad">Counter-evidence</dt>
                            <dd className="mt-0.5 text-xs leading-relaxed text-muted">
                              {h.counter_evidence || (
                                <span className="text-bad">
                                  None recorded — this hypothesis has been asserted, not tested.
                                </span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {h.distinguishing_test && (
                          <p className="mt-3 rounded border border-edge bg-panel px-3 py-2 text-xs leading-relaxed text-text">
                            <span className="text-muted">Cheapest test that separates this from the others · </span>
                            {h.distinguishing_test}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </Panel>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Constraint" subtitle="A causal hypothesis about what is limiting the objective — never a checklist score.">
            {(constraints.data ?? []).length === 0 ? <Empty what="No constraint opened." /> : (
              <ul className="space-y-4">
                {constraints.data!.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed text-text">{c.statement}</p>
                      <Tag tone={c.status === "confirmed" ? "bad" : "warn"}>{c.status.replace(/_/g, " ")}</Tag>
                    </div>
                    {c.factor && (
                      <p className="mt-2 text-xs text-accent">
                        {FACTORS[c.factor]?.title} — {FACTORS[c.factor]?.asks}
                      </p>
                    )}
                    {c.mechanism && <p className="mt-2 text-xs leading-relaxed text-muted">{c.mechanism}</p>}
                    {c.falsified_by && (
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        <span className="text-bad">Disproved if · </span>{c.falsified_by}
                      </p>
                    )}
                    {c.next_likely && (
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        <span className="text-warn">Next constraint expected · </span>{c.next_likely}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="The four factors" subtitle="Every operating problem is examined through all four.">
          <ul className="space-y-3">
            {Object.entries(FACTORS).map(([key, f]) => {
              const active = (constraints.data ?? []).some((c) => c.factor === key);
              return (
                <li key={key} className={active ? "" : "opacity-50"}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text">{f.title}</span>
                    {active && <Tag tone="warn">in play</Tag>}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.asks}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
