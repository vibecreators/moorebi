"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { assertMember, toMinor, requiredText, optionalText } from "@/lib/auth";

/**
 * Write paths for the Phase 1 loop (audit finding P1-1).
 *
 * Every action begins with `await assertMember(entityId)`. A test asserts this
 * for every exported action in this file and fails if one is added without it.
 *
 * Errors are returned as a value rather than thrown, so a form can show the
 * database's own message. That matters here: the integrity triggers in 0005
 * produce genuinely useful text ("payments on invoice X total Y which exceeds
 * the invoice value of Z"), and swallowing it into "something went wrong"
 * would hide the one explanation the user needs.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(entityId: string, fn: () => Promise<void>, paths: string[]): Promise<ActionResult> {
  try {
    await assertMember(entityId);
    await fn();
    paths.forEach((p) => revalidatePath(p));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------- OBSERVE

export async function acknowledgeSignal(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("signals")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user!.id })
      .eq("id", String(form.get("signal_id")))
      .eq("entity_id", entityId);
    if (error) throw new Error(error.message);
  }, ["/"]);
}

// ------------------------------------------------------------------ CASH

export async function recordPayment(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const { error } = await supabaseServer().from("payments").insert({
      entity_id: entityId,
      invoice_id: requiredText(form.get("invoice_id"), "Invoice"),
      amount: toMinor(form.get("amount")),
      currency: String(form.get("currency") || "NGN"),
      received_on: requiredText(form.get("received_on"), "Date received"),
      method: optionalText(form.get("method")),
      reference: optionalText(form.get("reference")),
      // Typed by a person unless it came from a bank feed. Not "confirmed".
      source_status: "reported",
    });
    if (error) throw new Error(error.message);
  }, ["/", "/execute", "/review"]);
}

export async function createInvoice(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const { error } = await supabaseServer().from("invoices").insert({
      entity_id: entityId,
      customer_id: requiredText(form.get("customer_id"), "Customer"),
      invoice_no: requiredText(form.get("invoice_no"), "Invoice number"),
      amount: toMinor(form.get("amount")),
      issued_on: requiredText(form.get("issued_on"), "Issue date"),
      due_on: requiredText(form.get("due_on"), "Due date"),
      status: "issued",
    });
    if (error) throw new Error(error.message);
  }, ["/", "/execute", "/model"]);
}

export async function createCustomer(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const { error } = await supabaseServer().from("customers").insert({
      entity_id: entityId,
      name: requiredText(form.get("name"), "Name"),
      segment: optionalText(form.get("segment")),
      payment_terms_days: Number(form.get("payment_terms_days") || 30),
    });
    if (error) throw new Error(error.message);
  }, ["/model", "/execute"]);
}

// --------------------------------------------------------------- EXECUTE

export async function createCommitment(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("commitments").insert({
      entity_id: entityId,
      promised_result: requiredText(form.get("promised_result"), "Promised result"),
      owner_id: user!.id,
      due_date: requiredText(form.get("due_date"), "Due date"),
      status: "open",
    });
    if (error) throw new Error(error.message);
  }, ["/", "/execute"]);
}

/**
 * Completion requires evidence — the database rejects `met` without it, so
 * this cannot become a checkbox. Task completion is not outcome completion.
 */
export async function completeCommitment(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const { error } = await supabaseServer().from("commitments").update({
      status: "met",
      completion_evidence: requiredText(form.get("completion_evidence"), "Completion evidence"),
      completed_at: new Date().toISOString(),
    })
      .eq("id", String(form.get("commitment_id")))
      .eq("entity_id", entityId);
    if (error) throw new Error(error.message);
  }, ["/", "/execute"]);
}

// ---------------------------------------------------------------- DECIDE

export async function createDecision(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("decisions").insert({
      entity_id: entityId,
      title: requiredText(form.get("title"), "Title"),
      category: optionalText(form.get("category")),
      context: optionalText(form.get("context")),
      alternatives: optionalText(form.get("alternatives")),
      recommendation: optionalText(form.get("recommendation")),
      expected_mechanism: optionalText(form.get("expected_mechanism")),
      must_protect: optionalText(form.get("must_protect")),
      assumptions: optionalText(form.get("assumptions")),
      dissent: optionalText(form.get("dissent")),
      confidence: String(form.get("confidence") || "unknown"),
      requested_by: user!.id,
      status: "requested",
    });
    if (error) throw new Error(error.message);
  }, ["/", "/decide"]);
}

/**
 * Approval is an authority act. The database requires an approver and a review
 * date together, so an approved decision nobody ever reviews cannot exist.
 */
export async function approveDecision(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("decisions").update({
      status: "approved",
      approved_by: user!.id,
      approved_at: new Date().toISOString(),
      implementation_owner: user!.id,
      review_on: requiredText(form.get("review_on"), "Review date"),
    })
      .eq("id", String(form.get("decision_id")))
      .eq("entity_id", entityId);
    if (error) throw new Error(error.message);
  }, ["/", "/decide"]);
}

// ---------------------------------------------------------------- REVIEW

export async function saveWeeklyReview(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("weekly_reviews").upsert({
      entity_id: entityId,
      week_start: requiredText(form.get("week_start"), "Week starting"),
      what_happened: optionalText(form.get("what_happened")),
      material_changes: optionalText(form.get("material_changes")),
      cash_collected: optionalText(form.get("cash_collected")),
      cash_overdue: optionalText(form.get("cash_overdue")),
      blocked: optionalText(form.get("blocked")),
      current_constraint: optionalText(form.get("current_constraint")),
      decision_required: optionalText(form.get("decision_required")),
      learned: optionalText(form.get("learned")),
      facilitator_id: user!.id,
      completed_at: new Date().toISOString(),
    }, { onConflict: "entity_id,week_start" });
    if (error) throw new Error(error.message);
  }, ["/review", "/"]);
}

// ----------------------------------------------------------------- LEARN

export async function recordOutcome(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("outcomes").insert({
      entity_id: entityId,
      intervention_id: optionalText(form.get("intervention_id")),
      expected: optionalText(form.get("expected")),
      actual: requiredText(form.get("actual"), "What actually happened"),
      classification: String(form.get("classification") || "inconclusive"),
      unintended: optionalText(form.get("unintended")),
      reviewed_on: new Date().toISOString().slice(0, 10),
      reviewed_by: user!.id,
    });
    if (error) throw new Error(error.message);
  }, ["/learn"]);
}

export async function addLearning(form: FormData): Promise<ActionResult> {
  const entityId = String(form.get("entity_id"));
  return run(entityId, async () => {
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("learnings").insert({
      entity_id: entityId,
      outcome_id: optionalText(form.get("outcome_id")),
      statement: requiredText(form.get("statement"), "Learning"),
      applies_to: optionalText(form.get("applies_to")),
      created_by: user!.id,
    });
    if (error) throw new Error(error.message);
  }, ["/learn"]);
}
