import { supabaseServer } from "@/lib/supabase/server";
import { Panel, Evidence, Empty, StageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Order matters: strongest first, Unknown last and visible. */
const LADDER = [
  { key: "confirmed",  meaning: "Observed directly in a source system." },
  { key: "calculated", meaning: "Derived from other values by a stated formula." },
  { key: "reported",   meaning: "Asserted by a person. Not verified." },
  { key: "inferred",   meaning: "Reasoned from evidence. Not observed." },
  { key: "judgment",   meaning: "Professional opinion." },
  { key: "assumption", meaning: "Taken as true in order to proceed." },
  { key: "contested",  meaning: "Sources disagree." },
  { key: "unknown",    meaning: "Not established. Never treated as healthy." },
];

export default async function EvidencePage() {
  const sb = supabaseServer();
  const { data } = await sb.from("evidence").select("*").order("created_at", { ascending: false });
  const rows = data ?? [];
  const counts = Object.fromEntries(LADDER.map((l) => [l.key, rows.filter((r) => r.status === l.key).length]));
  const unknowns = counts.unknown ?? 0;

  return (
    <>
      <StageHeader stage="Validate" />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        Every claim in MOORE OS carries its evidence status, so a measurement and a guess can never
        render identically. This is the difference between a dashboard and an operating system:
        a dashboard shows you a number, this shows you whether to believe it.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Evidence record" subtitle={`${rows.length} claims on file.`}>
            {rows.length === 0 ? <Empty what="No evidence recorded." /> : (
              <ul className="divide-y divide-edge">
                {rows.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm leading-relaxed ${r.status === "unknown" ? "text-muted" : "text-text"}`}>
                        {r.claim}
                      </p>
                      <Evidence status={r.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {r.source ?? "No source recorded"}
                      {r.observed_on && <> · observed {r.observed_on}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="The ladder">
            <ul className="space-y-2.5">
              {LADDER.map((l) => (
                <li key={l.key} className="flex items-start gap-2.5">
                  <Evidence status={l.key} />
                  <span className="min-w-0 text-xs leading-relaxed text-muted">
                    {l.meaning}
                    {counts[l.key] > 0 && <span className="text-text"> ({counts[l.key]})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {unknowns > 0 && (
            <Panel title="Known unknowns">
              <p className="text-sm leading-relaxed text-text">
                {unknowns} thing{unknowns === 1 ? " is" : "s are"} recorded as not established.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Kept visible on purpose. An unknown that is quietly dropped becomes an assumption
                nobody remembers making — which is how a health score ends up averaging away the
                one condition that mattered.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
