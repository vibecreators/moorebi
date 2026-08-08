/**
 * MOORE OS — money. Pure functions, no I/O, so the invariants are testable
 * without a database.
 *
 * The charter's central rule: invoiced, collected and outstanding are three
 * different numbers and are never derived from one another by assumption.
 * Collected cash comes only from payment records. There is no "paid" flag in
 * this codebase to forget to set.
 */

/** Money is minor units (kobo, cents) as integers. Never floats. */
export type Minor = number;

export interface Invoice {
  id: string;
  amount: Minor;
  currency: string;
  issued_on: string; // YYYY-MM-DD
  due_on: string;
  status: "draft" | "issued" | "disputed" | "void";
}

export interface Payment {
  invoice_id: string;
  amount: Minor;
  currency: string;
  received_on: string;
}

export interface Settlement {
  invoice_id: string;
  invoiced: Minor;
  collected: Minor;
  outstanding: Minor;
  is_overdue: boolean;
  days_overdue: number;
}

/** Void invoices are excluded everywhere: they were never a claim on anyone. */
const billable = (i: Invoice) => i.status !== "void";

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

/**
 * Settle each invoice against its payments.
 *
 * `today` is required rather than read from the clock: overdue-ness is a
 * function of a stated date, and a figure that silently depends on when it was
 * computed cannot be reproduced or audited.
 */
export function settle(invoices: Invoice[], payments: Payment[], today: string): Settlement[] {
  const paidBy = new Map<string, Minor>();
  for (const p of payments) {
    paidBy.set(p.invoice_id, (paidBy.get(p.invoice_id) ?? 0) + p.amount);
  }
  return invoices.filter(billable).map((i) => {
    const collected = paidBy.get(i.id) ?? 0;
    const outstanding = i.amount - collected;
    const overdue = i.status === "issued" && outstanding > 0 && i.due_on < today;
    return {
      invoice_id: i.id,
      invoiced: i.amount,
      collected,
      outstanding,
      is_overdue: overdue,
      days_overdue: overdue ? daysBetween(i.due_on, today) : 0,
    };
  });
}

/** What was BILLED in a period — not revenue, not cash. */
export function invoicedInPeriod(invoices: Invoice[], from: string, to: string): Minor {
  return invoices
    .filter((i) => billable(i) && i.status !== "draft" && i.issued_on >= from && i.issued_on <= to)
    .reduce((s, i) => s + i.amount, 0);
}

/**
 * What was actually COLLECTED in a period, by the date cash arrived.
 *
 * Note this reads `payments` and never touches `invoices`. The two figures
 * cannot drift into each other, and an importer that creates invoices without
 * payments produces zero collected cash — correctly, and visibly.
 */
export function collectedInPeriod(payments: Payment[], from: string, to: string): Minor {
  return payments
    .filter((p) => p.received_on >= from && p.received_on <= to)
    .reduce((s, p) => s + p.amount, 0);
}

export interface AgeingBucket {
  label: string;
  from: number;
  to: number | null;
  amount: Minor;
  count: number;
}

/** Receivables ageing on outstanding balances only. */
export function ageing(settlements: Settlement[]): AgeingBucket[] {
  const buckets: AgeingBucket[] = [
    { label: "1–30 days", from: 1, to: 30, amount: 0, count: 0 },
    { label: "31–60 days", from: 31, to: 60, amount: 0, count: 0 },
    { label: "61–90 days", from: 61, to: 90, amount: 0, count: 0 },
    { label: "90+ days", from: 91, to: null, amount: 0, count: 0 },
  ];
  for (const s of settlements) {
    if (!s.is_overdue) continue;
    const b = buckets.find((x) => s.days_overdue >= x.from && (x.to === null || s.days_overdue <= x.to));
    if (b) { b.amount += s.outstanding; b.count += 1; }
  }
  return buckets;
}

/**
 * A currency-safe total. Mixed currencies are a real condition for a Nigerian
 * business with dollar costs, and summing them into one number is the kind of
 * quiet falsehood the charter forbids — so this refuses rather than guesses.
 */
export function totalIn(currency: string, rows: { amount: Minor; currency: string }[]): Minor {
  const foreign = rows.find((r) => r.currency !== currency);
  if (foreign) {
    throw new Error(
      `Refusing to total ${currency} with ${foreign.currency}: convert explicitly with a stated rate and date.`,
    );
  }
  return rows.reduce((s, r) => s + r.amount, 0);
}
