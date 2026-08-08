-- =====================================================================
-- MOORE OS — 0002 Grants and view security
--
-- Two defects in 0001, both found by executing an isolation probe rather
-- than by reading the migration:
--
--   1. RLS policies were created but no table privileges were granted to
--      `authenticated`. Policies filter ROWS; grants permit the STATEMENT.
--      Without both, every query fails "permission denied" — the schema was
--      unusable by the app.
--
--   2. `invoice_settlement` ran with its owner's rights. A Postgres view
--      defaults to security_invoker = false, meaning it executes as the
--      view owner (postgres) and therefore BYPASSES the RLS on the tables
--      beneath it. Any authenticated user could have read every tenant's
--      invoices and payments through it. This is the exact failure mode the
--      charter's tenancy invariant exists to prevent, and RLS-on-every-table
--      did not catch it, because the leak was in the view layer above.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Make the settlement view respect the caller's RLS.
-- ---------------------------------------------------------------------
alter view invoice_settlement set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 2. Statement-level privileges.
--
-- Row visibility is still decided entirely by the policies in 0001; these
-- grants only permit the statement to be attempted. `anon` receives nothing:
-- there is no unauthenticated surface in Phase 1.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','entities','memberships','stakeholders',
    'customers','contacts','objectives','opportunities','follow_ups',
    'commitments','invoices','payments','signals','decisions',
    'weekly_reviews','events'
  ] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Append-only to users: readable, never mutable from the client. Writes go
-- through the service role, which bypasses RLS by design.
grant select on audit_log to authenticated;
grant select on ai_usage  to authenticated;

grant select on invoice_settlement to authenticated;

-- bigserial-backed tables need their sequence to be usable by inserters.
grant usage, select on sequence events_id_seq to authenticated;

-- Future tables in this schema inherit the same posture, so a later migration
-- cannot silently create an unreachable — or over-exposed — table.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
