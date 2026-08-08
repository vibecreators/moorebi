import Link from "next/link";
import { requireEntity } from "@/lib/supabase/server";
import { LOOP } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const entity = await requireEntity();

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-8 px-6 py-6">
      <aside className="w-60 shrink-0">
        <div className="mb-6">
          <div className="text-sm font-semibold text-text">MOORE OS</div>
          <div className="mt-0.5 text-xs text-muted">{entity.name}</div>
        </div>

        {/* The nav IS the loop. Stages are numbered and never reordered, so the
            sequence is legible as a sequence rather than as a feature list. */}
        <nav className="space-y-0.5">
          {LOOP.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-panel"
            >
              <span className="mt-0.5 w-4 shrink-0 text-right text-[11px] tabular-nums text-muted/60">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm text-text">{s.stage}</span>
                <span className="block text-[11px] leading-tight text-muted">{s.blurb}</span>
              </span>
            </Link>
          ))}
        </nav>

        <form action="/auth/signout" method="post" className="mt-8">
          <button className="text-xs text-muted hover:text-text">Sign out</button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 pb-16">{children}</main>
    </div>
  );
}
