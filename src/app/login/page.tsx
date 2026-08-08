"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("founder@moore.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-text">MOORE OS</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The operating-intelligence layer for founder-led businesses.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs uppercase tracking-wide text-muted">Email</label>
            <input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs uppercase tracking-wide text-muted">Password</label>
            <input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>

          {error && <p role="alert" className="text-sm text-bad">{error}</p>}

          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 rounded-lg border border-edge bg-panel px-3 py-2 text-xs leading-relaxed text-muted">
          Demo account: <span className="text-text">founder@moore.demo</span> · password{" "}
          <span className="text-text">MooreDemo!2026</span>
        </p>
      </div>
    </main>
  );
}
