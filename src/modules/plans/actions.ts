"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import {
  planSchema,
  planEditSchema,
  priceSchema,
  type PlanInput,
  type PlanEditInput,
  type PriceInput,
} from "./schema";

export async function createPlan(
  values: PlanInput
): Promise<{ error: string } | void> {
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .rpc("create_plan", {
      p_name: parsed.data.name,
      p_price: parsed.data.price,
      p_duration_unit: parsed.data.duration_unit,
      p_duration_count: parsed.data.duration_count,
      p_description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo crear el plan" };
  }

  revalidatePath("/plans");
  redirect(`/plans/${data.id}`);
}

export async function updatePlan(
  id: string,
  values: PlanEditInput
): Promise<{ error: string } | { success: true }> {
  const parsed = planEditSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      duration_unit: parsed.data.duration_unit,
      duration_count: parsed.data.duration_count,
    })
    .eq("id", id);

  if (error) {
    return { error: "No se pudo guardar los cambios" };
  }

  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
  return { success: true };
}

export async function schedulePlanPrice(
  planId: string,
  values: PriceInput
): Promise<{ error: string } | { success: true }> {
  const parsed = priceSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados" };
  }

  const supabase = await createSupabaseClient();

  // today_bogota(), not a JS date -- valid_from is compared against this
  // same DB-side "today" everywhere else (cron jobs, subscriptions), and a
  // Node server's own timezone could disagree with it near midnight.
  const { data: today, error: todayError } = await supabase.rpc(
    "today_bogota"
  );
  if (todayError) {
    return { error: "No se pudo programar el precio" };
  }

  // Only one pending (not-yet-effective) price change at a time -- a
  // second one stacked on top is confusing (which one did the admin
  // actually mean?) and easy to fix by just waiting for the first to land.
  const { data: pending, error: pendingError } = await supabase
    .from("plan_prices")
    .select("id, valid_from")
    .eq("plan_id", planId)
    .gt("valid_from", today)
    .limit(1)
    .maybeSingle();
  if (pendingError) {
    return { error: "No se pudo programar el precio" };
  }
  if (pending) {
    const date = new Date(`${pending.valid_from}T00:00:00`).toLocaleDateString(
      "es-CO"
    );
    return {
      error: `Ya hay un precio programado para el ${date}. Esperá a que se aplique antes de programar otro.`,
    };
  }

  // A "change" to the same price is a no-op that only clutters the
  // history with an extra row -- not worth letting through.
  const { data: currentPrice, error: currentPriceError } = await supabase.rpc(
    "plan_price_at",
    { p_plan_id: planId }
  );
  if (currentPriceError) {
    return { error: "No se pudo programar el precio" };
  }
  if (currentPrice != null && Number(currentPrice) === parsed.data.price) {
    return {
      error: "El precio nuevo es igual al vigente. No hace falta programar un cambio.",
    };
  }

  const { error } = await supabase.from("plan_prices").insert({
    plan_id: planId,
    price: parsed.data.price,
    valid_from: parsed.data.valid_from,
  });

  if (error) {
    return { error: "No se pudo programar el precio" };
  }

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { success: true };
}

export async function cancelScheduledPrice(
  planId: string,
  priceId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createSupabaseClient();

  // cancel_scheduled_plan_price (migration 0018) deletes the future row
  // AND reopens whichever row it had closed, atomically -- deleting the
  // row alone here would leave a coverage gap (no price from the day
  // after the closed row's valid_until onward). It also re-checks
  // server-side that the row is still in the future, in case it became
  // effective between page load and this call.
  const { error } = await supabase.rpc("cancel_scheduled_plan_price", {
    p_price_id: priceId,
  });

  if (error) {
    return {
      error: error.message.includes("not-yet-effective")
        ? "Ese precio ya está vigente y no se puede cancelar."
        : "No se pudo cancelar la programación",
    };
  }

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { success: true };
}

export async function setPlanActive(id: string, active: boolean) {
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
}
