import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Tag, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, "good" | "warn" | "bad" | "plain"> = {
  "payment.received": "good",
  "commitment.met": "good",
  "decision.approved": "warn",
  "intervention.started": "warn",
  "outcome.reviewed": "plain",
};

export default async function RememberPage() {
  const sb = supabaseServer();
  const [events, decisions, learnings] = await Promise.all([
    sb.from("events").select("*").order("occurred_at", { ascending: false }).limit(50),
    sb.from("decisions").select("id, title, approved_at, category").not("approved_at", "is", null),
    sb.from("learnings").select("id"),
  ]);

  return (
    <>
      <StageHeader stage="Remember" />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        The business memory. Not a chat log — the record of what was decided, what was done and
        what followed, held so the answer to <em>why did we do that?</em> does not depend on one
        person still working here.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-edge bg-panel p-4">
          <div className="text-xs text-muted">Authorised decisions</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{(decisions.data ?? []).length}</div>
        </div>
        <div className="rounded-lg border border-edge bg-panel p-4">
          <div className="text-xs text-muted">Learnings preserved</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{(learnings.data ?? []).length}</div>
        </div>
        <div className="rounded-lg border border-edge bg-panel p-4">
          <div className="text-xs text-muted">Events on record</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{(events.data ?? []).length}</div>
        </div>
      </div>

      <Panel title="Organizational timeline">
        {(events.data ?? []).length === 0 ? <Empty what="No events recorded." /> : (
          <ol className="relative space-y-4 border-l border-edge pl-6">
            {events.data!.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-edge ring-4 ring-ink" />
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={KIND_TONE[e.kind] ?? "plain"}>{e.kind}</Tag>
                  <span className="text-xs text-muted">
                    {new Date(e.occurred_at).toISOString().slice(0, 10)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-text">
                  {Object.entries(e.payload as Record<string, unknown>)
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                    .join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
