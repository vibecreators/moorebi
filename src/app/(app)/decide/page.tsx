import { supabaseServer, requireEntity } from "@/lib/supabase/server";
import { ActionForm, Field, Input, Textarea, Select, Hidden } from "@/components/ActionForm";
import { createDecision, approveDecision } from "@/app/actions/operate";
import { Panel, Evidence, Tag, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_TONE = {
  keep: "good", build: "good", repair: "warn",
  redesign: "warn", delay: "plain", stop: "bad",
} as const;

export default async function DecidePage() {
  const sb = supabaseServer();
  const entity = await requireEntity();
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

      <div className="mb-4">
        <Panel title="Request a decision" subtitle="The memo is the point. A title alone is a task, not a decision.">
          <ActionForm action={createDecision} submitLabel="Record decision request">
            <Hidden name="entity_id" value={entity.id} />
            <Field label="What is being decided?"><Input name="title" required placeholder="Suspend credit for accounts over 45 days" /></Field>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Category"><Select name="category" options={["keep","build","repair","redesign","delay","stop"]} /></Field>
              <Field label="Confidence"><Select name="confidence" options={["unknown","assumption","judgment","inferred","reported","calculated","confirmed"]} /></Field>
            </div>
            <Field label="Why now?"><Textarea name="context" /></Field>
            <Field label="Alternatives considered"><Textarea name="alternatives" placeholder="One per line" /></Field>
            <Field label="Recommendation"><Textarea name="recommendation" /></Field>
            <Field label="Expected mechanism — how is this supposed to produce the result?"><Textarea name="expected_mechanism" /></Field>
            <Field label="Must protect"><Textarea name="must_protect" /></Field>
            <Field label="Dissent — who disagreed, and why?"><Textarea name="dissent" placeholder="Preserved, not tidied away" /></Field>
          </ActionForm>
        </Panel>
      </div>

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

              {d.status !== "approved" && (
                <div className="mt-3 rounded-lg border border-edge bg-ink/40 p-3">
                  <ActionForm action={approveDecision} submitLabel="Authorise">
                    <Hidden name="entity_id" value={entity.id} />
                    <Hidden name="decision_id" value={d.id} />
                    <Field label="Review date — when will we check whether this worked?">
                      <Input name="review_on" type="date" required />
                    </Field>
                    <p className="text-[11px] leading-relaxed text-muted">
                      Approving records you as the authority. A review date is mandatory: the database
                      rejects an approved decision that nobody has undertaken to review.
                    </p>
                  </ActionForm>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
