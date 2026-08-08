import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Tag, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CLASS_TONE = {
  confirmed: "good", partially_confirmed: "warn", inconclusive: "plain",
  rejected: "bad", harmful: "bad", not_used: "plain",
} as const;

export default async function LearnPage() {
  const sb = supabaseServer();
  const [outcomes, learnings] = await Promise.all([
    sb.from("outcomes").select("*").order("reviewed_on", { ascending: false }),
    sb.from("learnings").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <StageHeader stage="Learn" />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        The decision is not the outcome. This step compares what was expected against what reality
        produced — including the things nobody predicted. An organization that never does this
        cannot tell a good decision from a lucky one.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Outcomes" subtitle="Expected versus actual, classified honestly.">
          {(outcomes.data ?? []).length === 0 ? (
            <Empty what="No outcomes reviewed." why="An intervention without a review is an untested belief." />
          ) : (
            <ul className="space-y-4">
              {outcomes.data!.map((o) => (
                <li key={o.id} className="rounded-lg border border-edge bg-ink/40 p-4">
                  <Tag tone={CLASS_TONE[o.classification as keyof typeof CLASS_TONE]}>
                    {o.classification.replace(/_/g, " ")}
                  </Tag>
                  <dl className="mt-3 space-y-3">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted">Expected</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-muted">{o.expected}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-text">Actual</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-text">{o.actual}</dd>
                    </div>
                    {o.unintended && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-warn">Unintended</dt>
                        <dd className="mt-0.5 text-xs leading-relaxed text-warn">{o.unintended}</dd>
                      </div>
                    )}
                  </dl>
                  {o.reviewed_on && <p className="mt-3 text-xs text-muted">Reviewed {o.reviewed_on}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Learnings" subtitle="Conclusions that should change what happens next time.">
          {(learnings.data ?? []).length === 0 ? <Empty what="Nothing recorded yet." /> : (
            <ul className="space-y-4">
              {learnings.data!.map((l) => (
                <li key={l.id} className="border-l-2 border-accent/50 pl-4">
                  <p className="text-sm leading-relaxed text-text">{l.statement}</p>
                  {l.applies_to && (
                    <p className="mt-1.5 text-xs text-muted">
                      <span className="text-accent">Applies to · </span>{l.applies_to}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
