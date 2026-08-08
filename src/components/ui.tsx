import Link from "next/link";
import type { ReactNode } from "react";

/** Money is stored in minor units. Never format a float. */
export function naira(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return "₦" + (minor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function Panel({ title, subtitle, children, right }: {
  title?: string; subtitle?: string; children: ReactNode; right?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-edge bg-panel p-5">
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone = "plain" }: {
  label: string; value: string; note?: string; tone?: "plain" | "good" | "warn" | "bad";
}) {
  const toneClass = { plain: "text-text", good: "text-good", warn: "text-warn", bad: "text-bad" }[tone];
  return (
    <div className="rounded-lg border border-edge bg-ink/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {note && <div className="mt-1 text-xs leading-relaxed text-muted">{note}</div>}
    </div>
  );
}

/**
 * The evidence badge. Every claim the system shows carries one of these, so a
 * measurement and a guess can never look the same on screen.
 */
export function Evidence({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:  { label: "Confirmed",  cls: "border-good/40 bg-good/10 text-good" },
    calculated: { label: "Calculated", cls: "border-accent/40 bg-accent/10 text-accent" },
    reported:   { label: "Reported",   cls: "border-warn/40 bg-warn/10 text-warn" },
    inferred:   { label: "Inferred",   cls: "border-warn/40 bg-warn/10 text-warn" },
    judgment:   { label: "Judgment",   cls: "border-warn/40 bg-warn/10 text-warn" },
    assumption: { label: "Assumption", cls: "border-bad/40 bg-bad/10 text-bad" },
    unknown:    { label: "Unknown",    cls: "border-bad/50 bg-bad/15 text-bad" },
    contested:  { label: "Contested",  cls: "border-bad/40 bg-bad/10 text-bad" },
  };
  const s = map[status] ?? map.unknown;
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "bad" }) {
  const cls = {
    plain: "border-edge text-muted",
    good: "border-good/40 bg-good/10 text-good",
    warn: "border-warn/40 bg-warn/10 text-warn",
    bad: "border-bad/40 bg-bad/10 text-bad",
  }[tone];
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function Empty({ what, why }: { what: string; why?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-edge px-4 py-8 text-center">
      <p className="text-sm text-muted">{what}</p>
      {why && <p className="mt-1 text-xs text-muted/70">{why}</p>}
    </div>
  );
}

/** The loop. Order is meaningful and the nav never reorders it. */
export const LOOP = [
  { href: "/",          stage: "Observe",  blurb: "What is happening" },
  { href: "/model",     stage: "Model",    blurb: "What this business is" },
  { href: "/evidence",  stage: "Validate", blurb: "What is actually proved" },
  { href: "/diagnose",  stage: "Diagnose", blurb: "Why it is happening" },
  { href: "/decide",    stage: "Decide",   blurb: "What we chose, and who authorised it" },
  { href: "/execute",   stage: "Execute",  blurb: "What we actually did" },
  { href: "/review",    stage: "Review",   blurb: "The weekly rhythm" },
  { href: "/learn",     stage: "Learn",    blurb: "What reality produced" },
  { href: "/remember",  stage: "Remember", blurb: "What the business knows" },
] as const;

export function StageHeader({ stage }: { stage: string }) {
  const i = LOOP.findIndex((s) => s.stage === stage);
  const item = LOOP[i];
  const next = LOOP[(i + 1) % LOOP.length];
  return (
    <div className="mb-6 border-b border-edge pb-4">
      <div className="text-xs uppercase tracking-[0.2em] text-accent">
        Step {i + 1} of {LOOP.length} · {item.stage}
      </div>
      <h1 className="mt-1 text-2xl font-semibold text-text">{item.blurb}</h1>
      <p className="mt-2 text-sm text-muted">
        Next in the loop:{" "}
        <Link href={next.href} className="text-accent hover:underline">
          {next.stage} — {next.blurb.toLowerCase()}
        </Link>
      </p>
    </div>
  );
}
