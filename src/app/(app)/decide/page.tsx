import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Evidence, Tag, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_TONE = {
  keep: "good", build: "good", repair: "warn",
  redesign: "warn", delay: "plain", stop: "bad",
} as const;

export default async function DecidePage() {
  const sb = supabaseServer();
  const { data } = await sb.from("decisions").select("*").order("created_at", { ascending: false });
  const rows = data ?? [];

  const block = (label: string, body: string | null, tone = "text-muted") =>
    body ? (
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
        <dd className={`mt-1 whitespace-pre-line text-xs leading-relaxed ${tone}`}>{body}</dd>
      </div>
    ) : null;

  return (
    <>
      <StageHeader stage="Decide" />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        A decision record is not a log line. It carries the alternatives that were actually
        considered, the mechanism by which the choice is supposed to work, what must not be
        damaged, who held the authority — and any dissent, preserved rather than tidied away.
      </p>

      {rows.length === 0 ? <Empty what="No decisions recorded." /> : (
        <div className="space-y-4">
          {rows.map((d) => (
            <Panel key={d.id} title={d.title}
                   right={
                     <div className="flex shrink-0 gap-1.5">
                       {d.category && (
                         <Tag tone={CATEGORY_TONE[d.category as keyof typeof CATEGORY_TONE]}>{d.category}</Tag>
                       )}
                       <Tag tone={d.status === "approved" ? "good" : "warn"}>{d.status}</Tag>
                       <Evidence status={d.confidence} />
                     </div>
                   }>
              <dl className="grid gap-4 sm:grid-cols-2">
                {block("Context", d.context)}
                {block("Alternatives considered", d.alternatives)}
                {block("Recommendation", d.recommendation, "text-text")}
                {block("Expected mechanism", d.expected_mechanism)}
                {block("Must protect", d.must_protect, "text-warn")}
                {block("Assumptions", d.assumptions)}
              </dl>

              {d.dissent && (
                <div className="mt-4 rounded-lg border border-bad/40 bg-bad/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-bad">Dissent — preserved</div>
                  <p className="mt-1 text-xs leading-relaxed text-text">{d.dissent}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-edge pt-3 text-xs text-muted">
                <span>
                  {d.approved_at
                    ? <>Authorised {new Date(d.approved_at).toISOString().slice(0, 10)}</>
                    : <span className="text-warn">Not yet authorised</span>}
                </span>
                {d.review_on && <span>Review due {d.review_on}</span>}
                {d.reviewed_at && <span className="text-good">Reviewed</span>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
