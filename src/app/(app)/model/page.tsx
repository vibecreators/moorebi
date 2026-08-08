import { supabaseServer, requireEntity } from "@/lib/supabase/server";
import { Panel, Empty, StageHeader, naira, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  const sb = supabaseServer();
  const entity = await requireEntity();

  const [stakeholders, customers, objectives, settlement] = await Promise.all([
    sb.from("stakeholders").select("*").order("kind"),
    sb.from("customers").select("id, name, segment, payment_terms_days"),
    sb.from("objectives").select("*").order("period_end"),
    sb.from("invoice_settlement").select("customer_id, invoiced, collected, outstanding, is_overdue"),
  ]);

  // Concentration: how much of the overdue book sits with each customer. This
  // is the smallest useful piece of the Business Graph — a dependency that is
  // invisible while you look at invoices one at a time.
  const byCustomer = new Map<string, { overdue: number; invoiced: number }>();
  for (const r of settlement.data ?? []) {
    const cur = byCustomer.get(r.customer_id) ?? { overdue: 0, invoiced: 0 };
    cur.invoiced += Number(r.invoiced);
    if (r.is_overdue) cur.overdue += Number(r.outstanding);
    byCustomer.set(r.customer_id, cur);
  }
  const totalOverdue = [...byCustomer.values()].reduce((s, v) => s + v.overdue, 0);

  const field = (label: string, value: string | null) => (
    <div className="border-t border-edge py-2.5 first:border-t-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-text">{value || "—"}</dd>
    </div>
  );

  return (
    <>
      <StageHeader stage="Model" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Entity boundary"
               subtitle="Declared before anything is diagnosed, so a problem is attributed to the right level.">
          <dl>
            {field("Name", entity.legal_name)}
            {field("Inside this boundary", entity.boundary_note)}
            {field("Ownership", entity.ownership)}
            {field("Geography", entity.geography)}
            {field("Business model", entity.business_model)}
            {field("Reporting period", entity.reporting_period)}
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel title="Objectives" subtitle="A defined result, for a defined period.">
            {(objectives.data ?? []).length === 0 ? <Empty what="No objectives set." /> : (
              <ul className="space-y-3">
                {objectives.data!.map((o) => (
                  <li key={o.id}>
                    <p className="text-sm text-text">{o.statement}</p>
                    <p className="mt-1 text-xs text-muted">
                      {o.period_start} → {o.period_end}
                      {o.target_value != null && <> · target {naira(Number(o.target_value))}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Stakeholders" subtitle="Who receives value, supplies it, or carries the risk.">
            {(stakeholders.data ?? []).length === 0 ? <Empty what="No stakeholders mapped." /> : (
              <ul className="space-y-3">
                {stakeholders.data!.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text">{s.name}</span>
                      <Tag>{s.kind}</Tag>
                    </div>
                    {s.interest && <p className="mt-1 text-xs text-muted">Wants: {s.interest}</p>}
                    {s.risk_borne && <p className="mt-0.5 text-xs text-warn">Carries: {s.risk_borne}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Panel title="Where the money is concentrated"
               subtitle="The overdue book by customer. A dependency you cannot see one invoice at a time.">
          {byCustomer.size === 0 ? <Empty what="No invoices yet." /> : (
            <ul className="space-y-3">
              {(customers.data ?? [])
                .map((c) => ({ ...c, ...(byCustomer.get(c.id) ?? { overdue: 0, invoiced: 0 }) }))
                .sort((a, b) => b.overdue - a.overdue)
                .map((c) => {
                  const share = totalOverdue > 0 ? (c.overdue / totalOverdue) * 100 : 0;
                  return (
                    <li key={c.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-text">
                          {c.name} <span className="text-xs text-muted">· {c.payment_terms_days}-day terms</span>
                        </span>
                        <span className="tabular-nums text-muted">
                          {c.overdue > 0 ? <span className="text-bad">{naira(c.overdue)} overdue</span> : "current"}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-ink">
                        <div className="h-full rounded bg-bad" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
