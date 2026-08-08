-- =====================================================================
-- MOORE OS — 0005 Payment integrity (audit findings P1-6, P1-7)
--
-- The audit accepted two corrupting payments:
--   P1-6  a payment far exceeding the invoice value
--   P1-7  a USD payment against an NGN invoice, summed into collected cash
--
-- `money.ts` already refuses to add naira to dollars and has a passing test
-- proving it. That test gave false assurance: the guard lives in a pure
-- function that nothing in the write path calls, while the database — the
-- only thing that actually gates a write — had no such rule.
--
-- So these guards go where writes are decided. The TypeScript versions stay
-- as fast feedback, but they are no longer the enforcement point.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A payment must belong to the same tenant and currency as its invoice,
--    and must not settle more than the invoice is worth.
--
-- Enforced as a CONSTRAINT TRIGGER so it is checked at the end of the
-- statement: a legitimate multi-row insert of several part-payments is
-- evaluated on the final total, not on whichever row happens to land first.
-- ---------------------------------------------------------------------
create or replace function enforce_payment_integrity()
returns trigger language plpgsql as $$
declare
  inv       record;
  total     bigint;
begin
  select i.entity_id, i.currency, i.amount, i.invoice_no, i.status
    into inv
    from invoices i
   where i.id = new.invoice_id;

  if not found then
    raise exception 'payment references a non-existent invoice';
  end if;

  -- Tenant consistency. Without this a payment row could be filed against
  -- another tenant's invoice; RLS checks the row being written, not the row
  -- it points at.
  if new.entity_id <> inv.entity_id then
    raise exception
      'payment entity (%) does not match invoice % entity (%)',
      new.entity_id, inv.invoice_no, inv.entity_id;
  end if;

  -- P1-7. Currencies are not interchangeable and there is no rate here to
  -- convert with. Refuse rather than quietly produce a meaningless total.
  if new.currency <> inv.currency then
    raise exception
      'currency mismatch: % payment against % invoice %. Convert explicitly with a stated rate and date.',
      new.currency, inv.currency, inv.invoice_no;
  end if;

  if inv.status = 'void' then
    raise exception 'cannot record a payment against void invoice %', inv.invoice_no;
  end if;

  -- P1-6. Collected cash may never exceed what was billed. An overpayment is
  -- real in business, but it is a credit note or a refund — not a settlement
  -- of this invoice — and silently allowing it inflates collected cash and
  -- drives outstanding negative.
  select coalesce(sum(p.amount), 0) into total
    from payments p where p.invoice_id = new.invoice_id;

  if total > inv.amount then
    raise exception
      'payments on invoice % total % which exceeds the invoice value of %. Record the excess as a credit, not a payment.',
      inv.invoice_no, total, inv.amount;
  end if;

  return null;
end $$;

revoke execute on function enforce_payment_integrity() from anon, authenticated, public;

create constraint trigger trg_payment_integrity
  after insert or update on payments
  deferrable initially immediate
  for each row execute function enforce_payment_integrity();

-- ---------------------------------------------------------------------
-- 2. The same tenant-consistency rule for the other cross-table reference
--    a user can supply: an invoice pointing at a customer or opportunity.
-- ---------------------------------------------------------------------
create or replace function enforce_invoice_integrity()
returns trigger language plpgsql as $$
declare owner_entity uuid;
begin
  select c.entity_id into owner_entity from customers c where c.id = new.customer_id;
  if owner_entity is null then
    raise exception 'invoice references a non-existent customer';
  end if;
  if owner_entity <> new.entity_id then
    raise exception 'invoice entity does not match its customer entity';
  end if;

  if new.opportunity_id is not null then
    select o.entity_id into owner_entity from opportunities o where o.id = new.opportunity_id;
    if owner_entity is distinct from new.entity_id then
      raise exception 'invoice entity does not match its opportunity entity';
    end if;
  end if;

  return null;
end $$;

revoke execute on function enforce_invoice_integrity() from anon, authenticated, public;

create constraint trigger trg_invoice_integrity
  after insert or update on invoices
  deferrable initially immediate
  for each row execute function enforce_invoice_integrity();
