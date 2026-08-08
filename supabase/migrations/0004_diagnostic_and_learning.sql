-- =====================================================================
-- MOORE OS — 0004 Diagnostic and learning objects
--
-- Completes the governing loop. 0001 covered OBSERVE / DECIDE / EXECUTE /
-- REVIEW / REMEMBER. This adds the middle and the end:
--
--   VALIDATE   -> evidence
--   DIAGNOSE   -> issues, hypotheses, constraints
--   EXECUTE    -> interventions (the change actually made)
--   LEARN      -> outcomes, learnings
--
-- The point of separating these from `decisions` is that a decision is a
-- choice, an intervention is what was actually done, and an outcome is what
-- reality produced. Collapsing them is how organizations convince themselves
-- a decision worked because it was made.
-- =====================================================================

create type issue_status      as enum ('open','investigating','diagnosed','closed');
create type hypothesis_status as enum ('proposed','testing','supported','rejected');
create type constraint_status as enum ('candidate','strong_hypothesis','paired','confirmed','rejected','unknown');
create type critical_factor   as enum ('right_context','right_supply','adequate_resources','internal_coherence');
create type outcome_class     as enum ('confirmed','partially_confirmed','inconclusive','rejected','harmful','not_used');

-- ---------------------------------------------------------------------
-- VALIDATE — evidence records
--
-- A claim and its provenance, held separately from whatever screen displays
-- it. `status` is the charter's evidence ladder, so "we think" and "we
-- measured" can never render identically.
-- ---------------------------------------------------------------------
create table evidence (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  claim         text not null,
  status        evidence_status not null default 'unknown',
  source        text,                 -- where it came from: system, person, document
  observed_on   date,
  subject_table text,                 -- what the claim is about
  subject_id    uuid,
  recorded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on evidence (entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- DIAGNOSE
-- ---------------------------------------------------------------------
create table issues (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete cascade,
  objective_id uuid references objectives(id) on delete set null,
  title        text not null,
  description  text,
  status       issue_status not null default 'open',
  severity     signal_severity not null default 'attention',
  owner_id     uuid references auth.users(id) on delete set null,
  opened_on    date not null default current_date,
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index on issues (entity_id, status);

create table hypotheses (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entities(id) on delete cascade,
  issue_id            uuid not null references issues(id) on delete cascade,
  statement           text not null,
  mechanism           text,           -- how this condition produces the observed result
  supporting_evidence text,
  -- Required, not optional. A hypothesis with no recorded counter-evidence
  -- has not been tested, it has been asserted -- so the field exists to make
  -- its emptiness visible rather than assumed.
  counter_evidence    text,
  distinguishing_test text,           -- the cheapest test that separates this from rivals
  confidence          evidence_status not null default 'unknown',
  status              hypothesis_status not null default 'proposed',
  created_at          timestamptz not null default now()
);
create index on hypotheses (entity_id, issue_id);

create table constraints (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entities(id) on delete cascade,
  objective_id   uuid references objectives(id) on delete set null,
  statement      text not null,
  status         constraint_status not null default 'candidate',
  factor         critical_factor,     -- which of the four lenses it sits under
  mechanism      text,
  falsified_by   text,                -- what observation would disprove it
  next_likely    text,                -- the constraint expected to bind next
  opened_on      date not null default current_date,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  -- A confirmed constraint must say how it was confirmed. Confirmation
  -- without a mechanism is a label, not a diagnosis.
  constraint constraints_confirmed_needs_mechanism
    check (status <> 'confirmed' or (mechanism is not null and confirmed_at is not null))
);
create index on constraints (entity_id, status);

-- ---------------------------------------------------------------------
-- EXECUTE — the change actually made
-- ---------------------------------------------------------------------
create table interventions (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entities(id) on delete cascade,
  decision_id       uuid references decisions(id) on delete set null,
  constraint_id     uuid references constraints(id) on delete set null,
  description       text not null,
  expected_mechanism text,
  expected_result   text,
  owner_id          uuid references auth.users(id) on delete set null,
  started_on        date,
  completed_on      date,
  review_on         date,
  created_at        timestamptz not null default now()
);
create index on interventions (entity_id);

-- ---------------------------------------------------------------------
-- LEARN — what reality produced, and what it taught
-- ---------------------------------------------------------------------
create table outcomes (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  intervention_id uuid references interventions(id) on delete cascade,
  decision_id     uuid references decisions(id) on delete set null,
  expected        text,
  actual          text,
  classification  outcome_class not null default 'inconclusive',
  unintended      text,
  reviewed_on     date,
  reviewed_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on outcomes (entity_id);

create table learnings (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  outcome_id  uuid references outcomes(id) on delete set null,
  statement   text not null,
  applies_to  text,          -- the situation in which this should change behaviour
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on learnings (entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS + grants, same posture as 0001/0002.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'evidence','issues','hypotheses','constraints','interventions','outcomes','learnings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %1$s_read on %1$s for select to authenticated
                      using (entity_id in (select private.user_entity_ids()))', t);
    execute format('create policy %1$s_write on %1$s for all to authenticated
                      using (private.can_write(entity_id))
                      with check (private.can_write(entity_id))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
