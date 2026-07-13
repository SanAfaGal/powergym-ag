"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  subscriptionSchema,
  paymentSchema,
  cancelSchema,
  type SubscriptionInput,
  type PaymentInput,
  type CancelInput,
} from "./schema";

const OPEN_STATUSES = ["active", "pending_payment", "scheduled"];

// Exact text of record_payment's two guards (migration 0022) -- matched
// below so these specific, actionable messages reach the staff member
// verbatim, while any other unexpected DB error falls back to a generic
// message instead of leaking raw Postgres error text to the UI. Same
// pattern as LAST_ADMIN_ERROR_MESSAGE in modules/staff/actions.ts.
const PAYMENT_OVERPAYMENT_ERROR_MESSAGE =
  "El monto supera el saldo pendiente de la suscripción";
const PAYMENT_INVALID_STATUS_ERROR_MESSAGE =
  "Esta suscripción no puede recibir pagos en su estado actual";

export async function createSubscription(
  clientId: string,
  values: SubscriptionInput
): Promise<{ error: string } | { success: true }> {
  const parsed = subscriptionSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();

  // The daily expire_subscriptions() cron (migration 0009) only runs once,
  // at midnight Bogota, so a membership that lapsed since then still reads
  // status='active' here. Expiring it eagerly, scoped to this client, means
  // the open-subscription check below doesn't wrongly treat a lapsed
  // membership as blocking, and avoids a later collision with
  // one_active_subscription_per_client if the new subscription gets paid
  // in full immediately (see migration 0025).
  const { error: expireError } = await supabase.rpc(
    "expire_stale_active_subscription",
    { p_client_id: clientId }
  );
  if (expireError) {
    return { error: "No se pudo crear la suscripción" };
  }

  // create_subscription's own uniqueness check (and the
  // one_active_subscription_per_client index) only blocks a duplicate
  // ACTIVE subscription -- it doesn't block a second one while the client
  // already has an unpaid (pending_payment) or scheduled one. That's a
  // real front-desk mistake, so it's blocked here at the app layer, same
  // pattern as schedulePlanPrice's "block a second pending price" check.
  const { data: openSubscription, error: openError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", clientId)
    .in("status", OPEN_STATUSES)
    .limit(1)
    .maybeSingle();
  if (openError) {
    return { error: "No se pudo crear la suscripción" };
  }
  if (openSubscription) {
    return {
      error:
        "El cliente ya tiene una suscripción activa, pendiente de pago o programada. Cancelala antes de crear una nueva.",
    };
  }

  const { error } = await supabase.rpc("create_subscription", {
    p_client_id: clientId,
    p_plan_id: parsed.data.plan_id,
    p_start_date: parsed.data.start_date,
    p_discount_amount: parsed.data.discount_amount ?? 0,
  });

  if (error) {
    return { error: "No se pudo crear la suscripción" };
  }

  revalidatePath("/subscriptions");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function recordPayment(
  subscriptionId: string,
  clientId: string,
  values: PaymentInput
): Promise<{ error: string } | { success: true }> {
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("record_payment", {
    p_subscription_id: subscriptionId,
    p_amount: parsed.data.amount,
    p_method: parsed.data.payment_method,
    p_notes: parsed.data.notes || null,
    p_bank_account_id: parsed.data.bank_account_id || null,
  });

  if (error) {
    return {
      error:
        error.message === PAYMENT_OVERPAYMENT_ERROR_MESSAGE ||
        error.message === PAYMENT_INVALID_STATUS_ERROR_MESSAGE
          ? error.message
          : "No se pudo registrar el pago",
    };
  }

  revalidatePath("/subscriptions");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function cancelSubscription(
  subscriptionId: string,
  clientId: string,
  values: CancelInput
): Promise<{ error: string } | { success: true }> {
  const parsed = cancelSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Ingresá un motivo de cancelación" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("cancel_subscription", {
    p_subscription_id: subscriptionId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: "No se pudo cancelar la suscripción" };
  }

  revalidatePath("/subscriptions");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function renewSubscription(
  subscriptionId: string,
  clientId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createSupabaseClient();

  // Same reasoning as createSubscription: the renewed row is created
  // pending_payment/scheduled, but if it's paid in full right away,
  // record_payment's "mark active" update would collide with
  // one_active_subscription_per_client if the old row -- the very one
  // being renewed -- is still 'active' because the daily cron hasn't
  // caught up to its end_date yet.
  const { error: expireError } = await supabase.rpc(
    "expire_stale_active_subscription",
    { p_client_id: clientId }
  );
  if (expireError) {
    return { error: "No se pudo renovar la suscripción" };
  }

  const { error } = await supabase.rpc("renew_subscription", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    return { error: "No se pudo renovar la suscripción" };
  }

  revalidatePath("/subscriptions");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
