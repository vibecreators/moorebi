import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client bound to the request's cookies, so every query
 * runs as the signed-in user and is therefore subject to RLS.
 *
 * There is deliberately no service-role client in the app tree. The service
 * role bypasses RLS, so a single careless import into a page component would
 * silently disable tenant isolation for that route.
 */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user's entity, redirecting to /login when there isn't one.
 *
 * Pages must use this rather than asserting non-null on `currentEntity()`.
 * Layouts and pages render concurrently in the App Router, so a page can
 * execute even while its layout is redirecting — an assertion there throws a
 * TypeError and surfaces as a 500 instead of a login screen. It also fails
 * that way whenever Supabase is simply unreachable, which is the worst
 * possible moment to lose the redirect.
 */
export async function requireEntity() {
  const entity = await currentEntity();
  if (!entity) redirect("/login");
  return entity;
}

/** The signed-in user's entity, or null. Phase 1 assumes one entity per user. */
export async function currentEntity() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("entities")
    .select("id, name, legal_name, boundary_note, ownership, geography, business_model, base_currency, reporting_period")
    .limit(1)
    .maybeSingle();

  return data ? { ...data, user } : null;
}
