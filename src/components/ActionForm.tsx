"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/actions/operate";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Wraps a server action and surfaces its error text verbatim.
 *
 * The database integrity triggers produce genuinely useful messages — "payments
 * on invoice ATL-0001 total 2300000001 which exceeds the invoice value of
 * 2300000000" — and replacing that with "something went wrong" would hide the
 * one explanation the user actually needs to act on.
 */
export function ActionForm({
  action, submitLabel, children, onDone,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        setSaved(false);
        const res = await action(fd);
        if (res.ok) {
          ref.current?.reset();
          setSaved(true);
          onDone?.();
        } else {
          setError(res.error);
        }
      }}
      className="space-y-2.5"
    >
      {children}
      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        {saved && <span className="text-xs text-good">Saved</span>}
      </div>
      {error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-2.5 py-2 text-xs leading-relaxed text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

const base =
  "w-full rounded-lg border border-edge bg-ink px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={base} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={2} className={base} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select {...props} className={base}>
      {options.map((o) => (
        <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
