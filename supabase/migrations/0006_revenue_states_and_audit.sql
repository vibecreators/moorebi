-- =====================================================================
-- MOORE OS — 0006 Revenue states + audit writer (audit findings P1-3, P1-4)
--
-- P1-3  The charter demands Contracted ≠ Booked ≠ Invoiced ≠ Collected.
--       Only the last two existed, so the central financial distinction was
--       half-implemented and unremarked.
--
-- P1-4  `audit_log` had correct RLS, correct indexes, and no writer. Nothing
--       had ever been logged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CONTRACTED — a signed commitment to buy. Not revenue, not cash.
-- ---------------------------------------------------------------------
create type contract_status as enum ('draft','signed','active','completed','cancelled');

create table contracts (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  customer_id    uuid not null references customers(id) on delete restrict,
  opportunity_id uuid references opportunities(id) on delete set null,
  contract_no    text not null,
  value          bigint not null check (value > 0),
  currency       char(3) not null default 'NGN',
  status         contract_status not null default 'draft',
  signed_on      date,
  starts_on      date,
  ends_on        date,
  created_at     timestamptz not null default now(),
  unique (entity_id, contract_no),
  -- A signed contract has a signature date. Without this, "contracted
  -- revenue" becomes a number with no point in time attached to it, and
  -- period reporting silently includes or excludes it at random.
  constraint contracts_signed_dated check (status = 'draft' or signed_on is not null),
  constraint contracts_period_ordered check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index on contracts (entity_id, status);

-- ---------------------------------------------------------------------
-- 2. BOOKED — value recognised as earned in a period because the work was
--    delivered. Distinct from contracted (promised) and invoiced (billed):
--    a contract may be signed in March, earned across April and May, billed
--    in June and collected in August. Those are four different months, and
--    conflating any two of them is how a profitable business runs out of cash.
-- ---------------------------------------------------------------------
create table bookings (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete cascade,
  contract_id  uuid not null references contracts(id) on delete cascade,
  amount       bigint not null check (amount > 0),
  currency     char(3) not null default 'NGN',
  period_month date not null,          -- always the 1st of the month
  booked_on    date not null default current_date,
  basis        text,                   -- why this was earned in this period
  status       evidence_status not null default 'reported',
  created_at   timestamptz not null default now(),
  constraint bookings_period_is_month_start check (extract(day from period_month) = 1)
);
create index on bookings (entity_id, period_month);

-- Bookings may not exceed the contract they are earned against, and must
-- share its tenant and currency — the same class of guard as 0005.
create or replace function enforce_booking_integrity()
returns trigger language plpgsql as $$
declare ct record; total bigint;
begin
  select c.entity_id, c.currency, c.value, c.contract_no into ct
    from contracts c where c.id = new.contract_id;
  if not found then raise exception 'booking references a non-existent contract'; end if;
  if new.entity_id <> ct.entity_id then
    raise exception 'booking entity does not match contract % entity', ct.contract_no;
  end if;
  if new.currency <> ct.currency then
    raise exception 'currency mismatch: % booking against % contract %', new.currency, ct.currency, ct.contract_no;
  end if;
  select coalesce(sum(b.amount),0) into total from bookings b where b.contract_id = new.contract_id;
  if total > ct.value then
    raise exception 'bookings on contract % total % which exceeds its value of %', ct.contract_no, total, ct.value;
  end if;
  return null;
end $$;
revoke execute on function enforce_booking_integrity() from anon, authenticated, public;
create constraint trigger trg_booking_integrity
  after insert or update on bookings deferrable initially immediate
  for each row execute function enforce_booking_integrity();

alter table invoices add column contract_id uuid references contracts(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. The four states side by side, per month, never collapsed.
-- ---------------------------------------------------------------------
create view revenue_states as
with months as (
  select entity_id, date_trunc('month', d)::date as period_month
  from (
    select entity_id, signed_on as d from contracts where signed_on is not null
    union all select entity_id, period_month from bookings
    union all select entity_id, issued_on from invoices where status <> 'void' and status <> 'draft'
    union all select entity_id, received_on from payments
  ) x
  group by entity_id, date_trunc('month', d)
)
select m.entity_id,
       m.period_month,
       coalesce((select sum(c.value) from contracts c
                  where c.entity_id = m.entity_id and c.status <> 'cancelled'
                    and date_trunc('month', c.signed_on)::date = m.period_month), 0) as contracted,
       coalesce((select sum(b.amount) from bookings b
                  where b.entity_id = m.entity_id and b.period_month = m.period_month), 0) as booked,
       coalesce((select sum(i.amount) from invoices i
                  where i.entity_id = m.entity_id and i.status not in ('void','draft')
                    and date_trunc('month', i.issued_on)::date = m.period_month), 0) as invoiced,
       coalesce((select sum(p.amount) from payments p
                  where p.entity_id = m.entity_id
                    and date_trunc('month', p.received_on)::date = m.period_month), 0) as collected
from months m;

alter view revenue_states set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 4. AUDIT WRITER (P1-4)
--
-- Implemented as database triggers rather than in the application, so an
-- action is logged because it touched the data — not because a developer
-- remembered to call a logger. A future write path cannot be added without
-- being audited.
--
-- SECURITY DEFINER because `audit_log` grants SELECT only to authenticated;
-- users may read their own audit trail and may never write to it.
-- ---------------------------------------------------------------------
create or replace function write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ent uuid;
  before_row jsonb;
  after_row  jsonb;
begin
  if tg_op = 'DELETE' then
    before_row := to_jsonb(old); after_row := null; ent := (to_jsonb(old)->>'entity_id')::uuid;
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old); after_row := to_jsonb(new); ent := (to_jsonb(new)->>'entity_id')::uuid;
  else
    before_row := null; after_row := to_jsonb(new); ent := (to_jsonb(new)->>'entity_id')::uuid;
  end if;

  insert into audit_log (entity_id, actor_id, action, subject_table, subject_id, detail)
  values (
    ent,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((after_row->>'id')::uuid, (before_row->>'id')::uuid),
    jsonb_strip_nulls(jsonb_build_object('before', before_row, 'after', after_row))
  );

  return null;
end $$;

revoke execute on function write_audit() from anon, authenticated, public;

do $$
declare t text;
begin
  foreach t in array array[
    'entities','memberships','customers','contacts','opportunities','follow_ups',
    'commitments','invoices','payments','contracts','bookings','decisions',
    'objectives','issues','hypotheses','constraints','interventions','outcomes',
    'learnings','evidence','weekly_reviews','signals','stakeholders'
  ] loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on %1$I
         for each row execute function write_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. RLS + grants for the new tables, matching the existing posture.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contracts','bookings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %1$s_read on %1$s for select to authenticated
                      using (entity_id in (select private.user_entity_ids()))', t);
    execute format('create policy %1$s_write on %1$s for all to authenticated
                      using (private.can_write(entity_id))
                      with check (private.can_write(entity_id))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant select on revenue_states to authenticated;
