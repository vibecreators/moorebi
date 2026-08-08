/**
 * MOORE OS — tenant isolation proof.
 *
 * WHY THIS FILE IS SHAPED LIKE THIS
 * ---------------------------------
 * The predecessor build had an equivalent suite that called `describe.skip`
 * when its secrets were absent. CI never supplied those secrets, so the suite
 * skipped silently for its entire life and every green check was a lie of
 * omission: 221 unit tests passing while the thing that actually protects
 * customer data had never once executed.
 *
 * So this suite does NOT skip. If it cannot run, it FAILS. A missing secret is
 * a broken safety gate, not an excusable local condition — and a red build is
 * the only signal that reliably gets fixed.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *               SUPABASE_SERVICE_ROLE_KEY, TEST_USER_PASSWORD
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PW = process.env.TEST_USER_PASSWORD;

describe("tenant isolation gate", () => {
  it("has the credentials required to prove isolation", () => {
    const missing = [
      ["NEXT_PUBLIC_SUPABASE_URL", URL],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON],
      ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
      ["TEST_USER_PASSWORD", PW],
    ].filter(([, v]) => !v).map(([k]) => k);

    expect(
      missing,
      `Tenant isolation cannot be proven: missing ${missing.join(", ")}. ` +
        `This is a FAILURE, not a skip — an unprovable isolation boundary is ` +
        `indistinguishable from a broken one.`,
    ).toEqual([]);
  });
});

// Two disposable tenants, torn down after the run.
const stamp = Date.now();
const A_EMAIL = `isolation-a-${stamp}@moore.test`;
const B_EMAIL = `isolation-b-${stamp}@moore.test`;

let admin: SupabaseClient;
let aClient: SupabaseClient;
let bClient: SupabaseClient;
let orgId: string;
let entityA: string;
let entityB: string;
let aUser: string;
let bUser: string;
let aCustomer: string;

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL!, ANON!);
  const { error } = await c.auth.signInWithPassword({ email, password: PW! });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

describe("cross-tenant reads and writes", () => {
  beforeAll(async () => {
    if (!URL || !ANON || !SERVICE || !PW) return; // the gate above already failed
    admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

    const mk = async (email: string) => {
      const { data, error } = await admin.auth.admin.createUser({
        email, password: PW, email_confirm: true,
      });
      if (error) throw error;
      return data.user!.id;
    };
    aUser = await mk(A_EMAIL);
    bUser = await mk(B_EMAIL);

    const org = await admin.from("organizations").insert({ name: `iso-${stamp}` }).select("id").single();
    orgId = org.data!.id;

    const ents = await admin.from("entities").insert([
      { organization_id: orgId, name: `Tenant A ${stamp}` },
      { organization_id: orgId, name: `Tenant B ${stamp}` },
    ]).select("id, name");
    entityA = ents.data!.find((e) => e.name.startsWith("Tenant A"))!.id;
    entityB = ents.data!.find((e) => e.name.startsWith("Tenant B"))!.id;

    await admin.from("memberships").insert([
      { entity_id: entityA, user_id: aUser, role: "founder" },
      { entity_id: entityB, user_id: bUser, role: "founder" },
    ]);

    const cust = await admin.from("customers")
      .insert({ entity_id: entityA, name: "A's confidential customer" })
      .select("id").single();
    aCustomer = cust.data!.id;

    await admin.from("invoices").insert({
      entity_id: entityA, customer_id: aCustomer, invoice_no: `A-${stamp}`,
      amount: 5_000_00, issued_on: "2026-01-01", due_on: "2026-02-01", status: "issued",
    });

    aClient = await signIn(A_EMAIL);
    bClient = await signIn(B_EMAIL);
  });

  afterAll(async () => {
    if (!admin) return;
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    for (const id of [aUser, bUser]) if (id) await admin.auth.admin.deleteUser(id);
  });

  it("A sees its own customers", async () => {
    const { data } = await aClient.from("customers").select("id");
    expect(data?.map((r) => r.id)).toContain(aCustomer);
  });

  it("B cannot read A's customers", async () => {
    const { data } = await bClient.from("customers").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("B cannot read A's invoices", async () => {
    const { data } = await bClient.from("invoices").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("B cannot read A's rows through the settlement view", async () => {
    const { data } = await bClient.from("invoice_settlement").select("invoice_id");
    expect(data ?? []).toEqual([]);
  });

  it("B cannot write into A's entity", async () => {
    const { error } = await bClient.from("customers")
      .insert({ entity_id: entityA, name: "injected by B" });
    expect(error).not.toBeNull();
  });

  it("B cannot update A's customer even knowing its id", async () => {
    const { data } = await bClient.from("customers")
      .update({ name: "hijacked" }).eq("id", aCustomer).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("B cannot delete A's customer", async () => {
    const { data } = await bClient.from("customers")
      .delete().eq("id", aCustomer).select("id");
    expect(data ?? []).toEqual([]);
    const { data: still } = await admin.from("customers").select("id").eq("id", aCustomer);
    expect(still).toHaveLength(1);
  });

  it("authorization helpers are not reachable as RPC endpoints", async () => {
    for (const fn of ["user_entity_ids", "is_moore_staff", "can_write"]) {
      const { error } = await bClient.rpc(fn as never, {} as never);
      expect(error, `${fn} should not be callable via PostgREST`).not.toBeNull();
    }
  });
});
