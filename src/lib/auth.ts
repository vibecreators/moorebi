import { supabaseServer } from "@/lib/supabase/server";

/**
 * Application-layer authorization for server actions.
 *
 * RLS is the real boundary and holds even if this is bypassed. This exists
 * because server actions are independently POST-invocable: layout gating is
 * UI only, so without an explicit check the sole defence would be a single
 * correct RLS policy, with nothing to catch a future mistaken one.
 *
 * The predecessor build shipped 96 server actions, 84 taking a client id, and
 * *none* verifying membership. Every action here must call this first, and
 * `tests/actions.test.ts` fails the build if a new one forgets.
 */
export class NotAuthorized extends Error {
  constructor(message = "Not authorized for this entity") {
    super(message);
    this.name = "NotAuthorized";
  }
}

const WRITE_ROLES = ["moore_admin", "operating_partner", "founder", "manager"];

export async function assertMember(entityId: string): Promise<string> {
  if (!entityId) throw new NotAuthorized("No entity supplied");

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new NotAuthorized("Not signed in");

  const { data, error } = await sb
    .from("memberships")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) throw new NotAuthorized();
  if (!WRITE_ROLES.includes(data.role)) {
    throw new NotAuthorized(`Role '${data.role}' may read but not write`);
  }
  return user.id;
}

/** Money arrives from forms as naira strings. Store minor units, never floats. */
export function toMinor(input: FormDataEntryValue | null): number {
  const n = Number(String(input ?? "").replace(/[₦,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount greater than zero");
  return Math.round(n * 100);
}

export function requiredText(input: FormDataEntryValue | null, field: string): string {
  const s = String(input ?? "").trim();
  if (!s) throw new Error(`${field} is required`);
  return s;
}

export function optionalText(input: FormDataEntryValue | null): string | null {
  const s = String(input ?? "").trim();
  return s === "" ? null : s;
}
