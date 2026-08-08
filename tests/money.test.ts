/**
 * Money invariants. These encode the charter rules as executable assertions,
 * and several of them are regression guards for defects the predecessor build
 * actually shipped.
 */
import { describe, it, expect } from "vitest";
import {
  settle, invoicedInPeriod, collectedInPeriod, ageing, totalIn,
  type Invoice, type Payment,
} from "../src/lib/money";

const inv = (o: Partial<Invoice> & { id: string; amount: number }): Invoice => ({
  currency: "NGN", issued_on: "2026-01-01", due_on: "2026-01-31", status: "issued", ...o,
});

describe("invoiced is not collected", () => {
  it("an issued, unpaid invoice contributes to invoiced and not to collected", () => {
    const invoices = [inv({ id: "i1", amount: 1_000_00 })];
    expect(invoicedInPeriod(invoices, "2026-01-01", "2026-01-31")).toBe(1_000_00);
    expect(collectedInPeriod([], "2026-01-01", "2026-01-31")).toBe(0);
  });

  it("partial payment leaves the remainder outstanding", () => {
    const invoices = [inv({ id: "i1", amount: 1_000_00 })];
    const payments: Payment[] = [
      { invoice_id: "i1", amount: 400_00, currency: "NGN", received_on: "2026-01-15" },
    ];
    const [s] = settle(invoices, payments, "2026-02-10");
    expect(s.invoiced).toBe(1_000_00);
    expect(s.collected).toBe(400_00);
    expect(s.outstanding).toBe(600_00);
    expect(s.is_overdue).toBe(true);
  });

  it("collected is attributed to the date cash arrived, not the invoice date", () => {
    const payments: Payment[] = [
      { invoice_id: "i1", amount: 500_00, currency: "NGN", received_on: "2026-03-04" },
    ];
    expect(collectedInPeriod(payments, "2026-01-01", "2026-01-31")).toBe(0);
    expect(collectedInPeriod(payments, "2026-03-01", "2026-03-31")).toBe(500_00);
  });

  /**
   * Predecessor R-02. Importing history marked "paid" left `paid_at` null, so
   * collected cash read zero and the engine announced a cash crisis that did
   * not exist. Here, importing invoices without payments correctly yields zero
   * collected — and importing the payments yields the real figure. The number
   * can only be wrong if the payments are genuinely absent.
   */
  it("imported history without payment rows reports zero collected, not a false total", () => {
    const invoices = Array.from({ length: 300 }, (_, n) =>
      inv({ id: `h${n}`, amount: 10_000_00, issued_on: "2025-06-01", due_on: "2025-07-01" }));
    expect(collectedInPeriod([], "2025-01-01", "2025-12-31")).toBe(0);

    const payments: Payment[] = invoices.map((i) => ({
      invoice_id: i.id, amount: i.amount, currency: "NGN", received_on: "2025-07-01",
    }));
    expect(collectedInPeriod(payments, "2025-01-01", "2025-12-31")).toBe(300 * 10_000_00);
    expect(settle(invoices, payments, "2026-01-01").every((s) => s.outstanding === 0)).toBe(true);
  });
});

describe("overdue and ageing", () => {
  it("a draft invoice is never overdue", () => {
    const [s] = settle([inv({ id: "d", amount: 500_00, status: "draft" })], [], "2026-06-01");
    expect(s.is_overdue).toBe(false);
  });

  it("a void invoice is excluded entirely", () => {
    expect(settle([inv({ id: "v", amount: 500_00, status: "void" })], [], "2026-06-01")).toHaveLength(0);
    expect(invoicedInPeriod([inv({ id: "v", amount: 500_00, status: "void" })], "2026-01-01", "2026-12-31")).toBe(0);
  });

  it("a fully paid invoice past its due date is not overdue", () => {
    const invoices = [inv({ id: "i1", amount: 1_000_00 })];
    const payments: Payment[] = [
      { invoice_id: "i1", amount: 1_000_00, currency: "NGN", received_on: "2026-01-20" },
    ];
    expect(settle(invoices, payments, "2026-09-01")[0].is_overdue).toBe(false);
  });

  it("buckets outstanding balances by age", () => {
    const invoices = [
      inv({ id: "a", amount: 100_00, due_on: "2026-05-25" }), // 10 days
      inv({ id: "b", amount: 200_00, due_on: "2026-04-20" }), // 45 days
      inv({ id: "c", amount: 300_00, due_on: "2026-01-01" }), // 154 days
    ];
    const b = ageing(settle(invoices, [], "2026-06-04"));
    expect(b[0]).toMatchObject({ amount: 100_00, count: 1 });
    expect(b[1]).toMatchObject({ amount: 200_00, count: 1 });
    expect(b[3]).toMatchObject({ amount: 300_00, count: 1 });
  });

  it("overdue-ness depends on the stated date, so results are reproducible", () => {
    const invoices = [inv({ id: "i1", amount: 100_00, due_on: "2026-03-01" })];
    expect(settle(invoices, [], "2026-02-01")[0].is_overdue).toBe(false);
    expect(settle(invoices, [], "2026-04-01")[0].is_overdue).toBe(true);
  });
});

describe("currency safety", () => {
  it("totals a single currency", () => {
    expect(totalIn("NGN", [
      { amount: 100, currency: "NGN" },
      { amount: 250, currency: "NGN" },
    ])).toBe(350);
  });

  it("refuses to add naira to dollars rather than producing a meaningless number", () => {
    expect(() => totalIn("NGN", [
      { amount: 100, currency: "NGN" },
      { amount: 50, currency: "USD" },
    ])).toThrow(/Refusing to total NGN with USD/);
  });
});
