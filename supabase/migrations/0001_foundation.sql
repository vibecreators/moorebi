-- =====================================================================
-- MOORE OS — 0001 Foundation (Phase 1: Operating Control)
--
-- Builds the ontology of docs/20-domain-model.md. Replaces the predecessor
-- schema per docs/15-decision-log.md D-003 (founder-authorized; all prior
-- data verified fictional before the drop).
--
-- Invariants made structural, not conventional:
--   * collected cash exists ONLY as rows in `payments` (D-004)
--   * estimates are never named revenue
--   * every claim carries an evidence_status, defaulting to 'unknown'
--   * every business table is entity-scoped with RLS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Reset.
--
-- First unschedule the predecessor's pg_cron jobs. These call
-- public.generate_*_notifications() daily and are the engine behind the
-- 31-consecutive-day re-notification defect (predecessor R-19). Dropping
-- the schema without unscheduling them would leave four jobs failing every
-- day forever, with nothing in this repo explaining why.
-- ---------------------------------------------------------------------
do $$
declare j record;
begin
  for j in select jobid, command from cron.job where command like '%public.generate_%' loop
    perform cron.unschedule(j.jobid);
    raise notice 'unscheduled predecessor cron job %: %', j.jobid, j.command;
  end loop;
end $$;

-- Drops the predecessor's 47 tables, enums and functions in one
-- dependency-ordered sweep. Verified beforehand: no extension is installed
-- in `public` (all live in extensions/pg_catalog/vault), so none is lost.
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to service_role;

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------

-- The charter's epistemic invariant. `unknown` is the default everywhere:
-- a claim must be positively marked as evidenced, never assumed to be.
create type evidence_status as enum (
  'confirmed',    -- observed directly in a source system
  'reported',     -- asserted by a person, not verified
  'calculated',   -- derived from other values by a stated formula
  'inferred',     -- reasoned from evidence, not observed
  'judgment',     -- professional opinion
  'assumption',   -- taken as true to proceed
  'unknown',      -- not established -- NEVER rendered as healthy
  'contested'     -- sources disagree
);

create type member_role as enum (
  'moore_admin',        -- MOORE staff; cross-entity operator console
  'operating_partner',  -- MOORE staff assigned to specific entities
  'founder',            -- customer-side principal, full authority
  'manager',            -- customer-side, delegated authority
  'member'              -- customer-side, own work only
);

create type opportunity_stage as enum (
  'lead','qualified','discovery','proposal','negotiation','won','lost'
);

create type commitment_status as enum (
  'open','at_risk','met','missed','cancelled'
);

create type decision_category as enum (
  'keep','build','repair','redesign','delay','stop'
);

create type decision_status as enum (
  'requested','under_review','approved','rejected','deferred','reviewed'
);

create type invoice_status as enum (
  'draft','issued','disputed','void'
  -- NOTE: no 'paid'. Paid-ness is derived from `payments`, never asserted. (D-004)
);

create type signal_severity as enum ('info','attention','urgent','critical');

-- ---------------------------------------------------------------------
-- 2. Identity and tenancy
-- ---------------------------------------------------------------------

-- The MOORE operating company (or a future reseller). Entities hang off it.
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

-- §3.1 Entity. Boundary before diagnosis: the unit being managed is declared
-- explicitly, including its parent, so a problem can be attributed to the
-- right level rather than to whichever unit reported it.
create table entities (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  parent_entity_id uuid references entities(id) on delete set null,
  name             text not null,
  legal_name       text,
  boundary_note    text,          -- what is inside and outside this entity
  ownership        text,
  geography        text,
  business_model   text,
  base_currency    char(3) not null default 'NGN',
  reporting_period text,
  created_at       timestamptz not null default now(),
  constraint entities_no_self_parent check (parent_entity_id is null or parent_entity_id <> id)
);
create index on entities (organization_id);
create index on entities (parent_entity_id);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (entity_id, user_id)
);
create index on memberships (user_id);

-- ---------------------------------------------------------------------
-- 3. Authorization helpers
--
-- SECURITY DEFINER so RLS policies can consult memberships without
-- recursing through the policies on memberships itself. EXECUTE is revoked
-- from PostgREST roles: these are policy internals, never API endpoints.
-- (Predecessor risk R-12: helper and trigger functions were reachable as
--  /rest/v1/rpc/* by anon.)
-- ---------------------------------------------------------------------

create or replace function user_entity_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select entity_id from memberships where user_id = auth.uid()
$$;

create or replace function is_moore_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
     where user_id = auth.uid()
       and role in ('moore_admin','operating_partner')
  )
$$;

create or replace function can_write(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
     where user_id = auth.uid()
       and entity_id = target
       and role in ('moore_admin','operating_partner','founder','manager')
  )
$$;

revoke execute on function user_entity_ids() from anon, authenticated, public;
revoke execute on function is_moore_staff() from anon, authenticated, public;
revoke execute on function can_write(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 4. Stakeholders, customers, contacts
-- ---------------------------------------------------------------------

-- §3.2 Anyone who receives value, supplies resources, carries risk or
-- exercises authority. Kept deliberately thin in Phase 1.
create table stakeholders (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  name       text not null,
  kind       text not null,   -- customer | employee | supplier | lender | regulator | ...
  interest   text,            -- what they receive or require
  risk_borne text,
  created_at timestamptz not null default now()
);
create index on stakeholders (entity_id);

create table customers (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  name           text not null,
  segment        text,
  owner_id       uuid references auth.users(id) on delete set null,
  payment_terms_days int not null default 30,
  credit_limit   bigint,       -- minor units, entity base currency
  notes          text,
  created_at     timestamptz not null default now()
);
create index on customers (entity_id);

create table contacts (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  full_name   text not null,
  role_title  text,
  email       text,
  phone       text,
  is_decision_maker boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on contacts (entity_id);
create index on contacts (customer_id);

-- ---------------------------------------------------------------------
-- 5. Objectives (§3.4)
-- ---------------------------------------------------------------------
create table objectives (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete cascade,
  statement    text not null,
  period_start date not null,
  period_end   date not null,
  target_value bigint,
  target_unit  text,
  owner_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint objectives_period_ordered check (period_end >= period_start)
);
create index on objectives (entity_id);

-- ---------------------------------------------------------------------
-- 6. Pipeline (§9)
-- ---------------------------------------------------------------------
create table opportunities (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  title           text not null,
  stage           opportunity_stage not null default 'lead',
  -- Named for what it is. This is a capture-time guess and is NEVER summed
  -- under a label containing the word "revenue". (Predecessor risk R-03.)
  estimated_value bigint,
  currency        char(3) not null default 'NGN',
  estimate_status evidence_status not null default 'assumption',
  probability     int check (probability between 0 and 100),
  expected_close  date,
  source          text,
  customer_problem   text,
  current_alternative text,   -- what they do today instead
  owner_id        uuid references auth.users(id) on delete set null,
  next_action     text,
  next_action_due date,
  won_at          timestamptz,
  lost_at         timestamptz,
  loss_reason     text,
  created_at      timestamptz not null default now(),
  -- A closed opportunity must record when. Prevents "won" rows with no date
  -- silently dropping out of period reporting.
  constraint opportunities_won_dated  check (stage <> 'won'  or won_at  is not null),
  constraint opportunities_lost_dated check (stage <> 'lost' or lost_at is not null)
);
create index on opportunities (entity_id, stage);
create index on opportunities (entity_id, next_action_due);

create table follow_ups (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  customer_id    uuid references customers(id) on delete cascade,
  due_date       date not null,
  note           text,
  owner_id       uuid references auth.users(id) on delete set null,
  completed_at   timestamptz,
  -- Escalation ceiling. The predecessor re-notified the same overdue item
  -- once a day for 31 consecutive days, all unread. Re-notification here
  -- requires an escalation step, and the step is capped.
  escalation_step  int not null default 0,
  last_notified_on date,
  created_at     timestamptz not null default now(),
  constraint follow_ups_escalation_ceiling check (escalation_step between 0 and 3)
);
create index on follow_ups (entity_id, due_date) where completed_at is null;

-- ---------------------------------------------------------------------
-- 7. Commitments (§3.13)
-- ---------------------------------------------------------------------
create table commitments (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete cascade,
  objective_id       uuid references objectives(id) on delete set null,
  promised_result    text not null,
  -- Exactly one accountable owner. Contributors are recorded separately;
  -- shared accountability is how commitments go unmet.
  owner_id           uuid not null references auth.users(id) on delete restrict,
  stakeholder_id     uuid references stakeholders(id) on delete set null,
  due_date           date not null,
  status             commitment_status not null default 'open',
  completion_evidence text,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  -- "Met" is not a checkbox: it requires evidence. Task completion is not
  -- outcome completion (charter financial/epistemic invariants).
  constraint commitments_met_needs_evidence
    check (status <> 'met' or (completion_evidence is not null and completed_at is not null))
);
create index on commitments (entity_id, status, due_date);
create index on commitments (owner_id) where status = 'open';

-- ---------------------------------------------------------------------
-- 8. Money (§10) — the charter's central invariant
--
-- `invoices` records what was BILLED. `payments` records what was COLLECTED.
-- There is no paid flag and no nullable paid_at anywhere in this section:
-- collected cash is a sum over payment rows and can be computed no other way.
-- ---------------------------------------------------------------------
create table invoices (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  customer_id    uuid not null references customers(id) on delete restrict,
  -- Reconciliation chain: opportunity -> invoice -> payment. Nullable because
  -- not all billing starts as a tracked opportunity, but present so that
  -- estimate-vs-actual is computable at all (the predecessor had the column
  -- and no write path, so reconciliation was impossible).
  opportunity_id uuid references opportunities(id) on delete set null,
  invoice_no     text not null,
  amount         bigint not null check (amount > 0),   -- minor units
  currency       char(3) not null default 'NGN',
  issued_on      date not null,
  due_on         date not null,
  status         invoice_status not null default 'draft',
  created_at     timestamptz not null default now(),
  unique (entity_id, invoice_no),
  constraint invoices_due_after_issue check (due_on >= issued_on)
);
create index on invoices (entity_id, status, due_on);
create index on invoices (customer_id);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete cascade,
  invoice_id   uuid not null references invoices(id) on delete cascade,
  amount       bigint not null check (amount > 0),
  currency     char(3) not null default 'NGN',
  received_on  date not null,          -- the date cash actually arrived
  method       text,
  reference    text,
  -- Was this seen in a bank/accounting feed, or typed by a person?
  source_status evidence_status not null default 'reported',
  created_at   timestamptz not null default now()
);
create index on payments (entity_id, received_on);
create index on payments (invoice_id);

-- Per-invoice settlement, derived. Nothing writes these numbers.
create view invoice_settlement as
  select i.id            as invoice_id,
         i.entity_id,
         i.customer_id,
         i.amount        as invoiced,
         coalesce(sum(p.amount), 0)            as collected,
         i.amount - coalesce(sum(p.amount), 0) as outstanding,
         max(p.received_on)                    as last_payment_on,
         (i.due_on < current_date
           and i.amount > coalesce(sum(p.amount), 0)
           and i.status = 'issued')            as is_overdue
    from invoices i
    left join payments p on p.invoice_id = i.id
   where i.status <> 'void'
   group by i.id;

-- ---------------------------------------------------------------------
-- 9. Signals (§3.7)
-- ---------------------------------------------------------------------
create table signals (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  kind        text not null,
  severity    signal_severity not null default 'info',
  summary     text not null,
  detail      text,
  status      evidence_status not null default 'calculated',
  subject_table text,
  subject_id  uuid,
  detected_on date not null default current_date,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- One signal per subject per kind per day. Combined with the follow-up
  -- escalation ceiling, this is what stops the predecessor's 31-day repeat.
  unique (entity_id, kind, subject_id, detected_on)
);
create index on signals (entity_id, detected_on desc);

-- ---------------------------------------------------------------------
-- 10. Decisions (§8)
-- ---------------------------------------------------------------------
create table decisions (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entities(id) on delete cascade,
  objective_id      uuid references objectives(id) on delete set null,
  title             text not null,
  category          decision_category,
  status            decision_status not null default 'requested',
  context           text,
  alternatives      text,
  recommendation    text,
  expected_mechanism text,          -- how this is supposed to produce the result
  must_protect      text,           -- what the decision must not damage
  assumptions       text,
  confidence        evidence_status not null default 'unknown',
  dissent           text,           -- preserved, never discarded
  requested_by      uuid references auth.users(id) on delete set null,
  -- Authority: who actually approved, and when. Both or neither.
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  implementation_owner uuid references auth.users(id) on delete set null,
  review_on         date,
  actual_outcome    text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint decisions_approval_paired
    check ((approved_by is null) = (approved_at is null)),
  -- An approved decision names an authority and a review date. A decision
  -- nobody reviews cannot produce learning.
  constraint decisions_approved_needs_authority
    check (status <> 'approved' or (approved_by is not null and review_on is not null))
);
create index on decisions (entity_id, status);

-- ---------------------------------------------------------------------
-- 11. Weekly review (§14)
-- ---------------------------------------------------------------------
create table weekly_reviews (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  week_start     date not null,
  what_happened  text,
  material_changes text,
  cash_collected text,
  cash_overdue   text,
  blocked        text,
  current_constraint text,
  decision_required  text,
  learned        text,
  facilitator_id uuid references auth.users(id) on delete set null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (entity_id, week_start)
);

-- ---------------------------------------------------------------------
-- 12. Event log and audit (§20.4)
-- ---------------------------------------------------------------------
create table events (
  id          bigserial primary key,
  entity_id   uuid not null references entities(id) on delete cascade,
  kind        text not null,
  subject_table text,
  subject_id  uuid,
  payload     jsonb not null default '{}'::jsonb,
  actor_id    uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index on events (entity_id, occurred_at desc);

create table audit_log (
  id         bigserial primary key,
  entity_id  uuid references entities(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  subject_table text,
  subject_id uuid,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (entity_id, created_at desc);

-- Every AI call is metered. Recorded unconditionally, including on failure
-- and timeout -- the predecessor billed tokens it never logged (R-09, R-10).
create table ai_usage (
  id             bigserial primary key,
  entity_id      uuid references entities(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  purpose        text not null,
  model          text not null,
  prompt_version text,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  cost_usd       numeric(10,6) not null default 0,
  latency_ms     int,
  outcome        text not null default 'ok',   -- ok | error | timeout | refused
  created_at     timestamptz not null default now()
);
create index on ai_usage (entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- 13. Row-level security — every table, no exemptions
-- ---------------------------------------------------------------------
alter table organizations  enable row level security;
alter table profiles       enable row level security;
alter table entities       enable row level security;
alter table memberships    enable row level security;
alter table stakeholders   enable row level security;
alter table customers      enable row level security;
alter table contacts       enable row level security;
alter table objectives     enable row level security;
alter table opportunities  enable row level security;
alter table follow_ups     enable row level security;
alter table commitments    enable row level security;
alter table invoices       enable row level security;
alter table payments       enable row level security;
alter table signals        enable row level security;
alter table decisions      enable row level security;
alter table weekly_reviews enable row level security;
alter table events         enable row level security;
alter table audit_log      enable row level security;
alter table ai_usage       enable row level security;

-- Identity
create policy profiles_self on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Scoped, not `using (true)` -- the predecessor's organizations table was
-- world-readable to any authenticated user (R-08).
create policy organizations_read on organizations
  for select to authenticated using (
    exists (select 1 from entities e
             where e.organization_id = organizations.id
               and e.id in (select user_entity_ids()))
  );

create policy entities_read on entities
  for select to authenticated using (id in (select user_entity_ids()));
create policy entities_write on entities
  for update to authenticated using (can_write(id)) with check (can_write(id));

create policy memberships_read on memberships
  for select to authenticated using (entity_id in (select user_entity_ids()));
create policy memberships_manage on memberships
  for all to authenticated using (can_write(entity_id)) with check (can_write(entity_id));

-- Business tables: read on membership, write on write-role. Generated so the
-- pattern cannot drift table by table.
do $$
declare t text;
begin
  foreach t in array array[
    'stakeholders','customers','contacts','objectives','opportunities',
    'follow_ups','commitments','invoices','payments','signals',
    'decisions','weekly_reviews','events'
  ] loop
    execute format(
      'create policy %1$s_read on %1$s for select to authenticated
         using (entity_id in (select user_entity_ids()))', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (can_write(entity_id)) with check (can_write(entity_id))', t);
  end loop;
end $$;

-- Audit and metering are append-only to users: readable, never mutable.
-- Writes go through the service role, which bypasses RLS.
create policy audit_log_read on audit_log
  for select to authenticated using (entity_id in (select user_entity_ids()));
create policy ai_usage_read on ai_usage
  for select to authenticated using (entity_id in (select user_entity_ids()));

-- ---------------------------------------------------------------------
-- 14. New-user profile provisioning
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function handle_new_user() from anon, authenticated, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
