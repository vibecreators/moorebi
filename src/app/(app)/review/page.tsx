import { supabaseServer, requireEntity } from "@/lib/supabase/server";
import { ActionForm, Field, Input, Textarea, Hidden } from "@/components/ActionForm";
import { saveWeeklyReview } from "@/app/actions/operate";
import { Panel, Empty, StageHeader, naira } from "@/components/ui";

export const dynamic = "force-dynamic";

/** The eleven questions. The weekly review is the habitual centre of the product. */
const QUESTIONS = [
  ["What happened?", "what_happened"],
  ["What changed materially?", "material_changes"],
  ["What cash was collected?", "cash_collected"],
  ["What cash is overdue?", "cash_overdue"],
  ["What is blocked?", "blocked"],
  ["What is the current constraint?", "current_constraint"],
  ["What decision is required?", "decision_required"],
  ["What did the company learn?", "learned"],
] as const;

export default async function ReviewPage() {
  const sb = supabaseServer();
  const entity = await requireEntity();
  const [reviews, settlement, commitments] = await Promise.all([
    sb.from("weekly_reviews").select("*").order("week_start", { ascending: false }),
    sb.from("invoice_settlement").select("outstanding, is_overdue"),
    sb.from("commitments").select("status"),
  ]);

  const rows = reviews.data ?? [];
  const overdue = (settlement.data ?? []).filter((r) => r.is_overdue)
    .reduce((s, r) => s + Number(r.outstanding), 0);
  const commits = commitments.data ?? [];
  const met = commits.filter((c) => c.status === "met").length;

  return (
    <>
      <StageHeader stage="Review" />

      <Panel title="Prepared for you"
             subtitle="Gathered from the data before the meeting, so the hour is spent deciding rather than assembling.">
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-lg border border-edge bg-ink/40 p-3">
            <div className="text-xs text-muted">Overdue now</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-bad">{naira(overdue)}</div>
          </li>
          <li className="rounded-lg border border-edge bg-ink/40 p-3">
            <div className="text-xs text-muted">Commitments met</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-text">{met}/{commits.length}</div>
          </li>
          <li className="rounded-lg border border-edge bg-ink/40 p-3">
            <div className="text-xs text-muted">Reviews on file</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-text">{rows.length}</div>
          </li>
        </ul>
      </Panel>

      <div className="mt-4">
        <Panel title="Run this week's review" subtitle="Eight questions. Answering them is the habit the product exists to create.">
          <ActionForm action={saveWeeklyReview} submitLabel="Save review">
            <Hidden name="entity_id" value={entity.id} />
            <Field label="Week starting"><Input name="week_start" type="date" required /></Field>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="What happened?"><Textarea name="what_happened" /></Field>
              <Field label="What changed materially?"><Textarea name="material_changes" /></Field>
              <Field label="What cash was collected?"><Textarea name="cash_collected" /></Field>
              <Field label="What cash is overdue?"><Textarea name="cash_overdue" /></Field>
              <Field label="What is blocked?"><Textarea name="blocked" /></Field>
              <Field label="What is the current constraint?"><Textarea name="current_constraint" /></Field>
              <Field label="What decision is required?"><Textarea name="decision_required" /></Field>
              <Field label="What did we learn?"><Textarea name="learned" /></Field>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <div className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <Empty what="No weekly reviews yet." why="The rhythm is the product. One review a week is the whole habit." />
        ) : (
          rows.map((r) => (
            <Panel key={r.id}
                   title={`Week of ${r.week_start}`}
                   subtitle={r.completed_at ? "Completed" : "In progress"}>
              <dl className="grid gap-4 sm:grid-cols-2">
                {QUESTIONS.map(([question, field]) => {
                  const answer = r[field as keyof typeof r] as string | null;
                  return (
                    <div key={field}>
                      <dt className="text-xs text-muted">{question}</dt>
                      <dd className={`mt-1 text-sm leading-relaxed ${answer ? "text-text" : "text-muted/50"}`}>
                        {answer || "Not answered"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Panel>
          ))
        )}
      </div>
    </>
  );
}
