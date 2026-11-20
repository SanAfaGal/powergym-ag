"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/session";

// Exact texts raised by close_clarification (migration 0060). Anything else falls back to a generic message
// so raw Postgres errors never reach the UI.
const KNOWN_ERRORS: Record<string, string> = {
  "Solo el staff activo puede cerrar una duda":
    "No tienes permiso para cerrar dudas",
};
const ALREADY_RESOLVED = /ya estaba resuelta/;
const NOT_FOUND = /No encuentro la duda/;

export async function closeDoubt(
  id: number
): Promise<{ error: string } | { success: true }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Duda no válida" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_clarification", { p_id: id });

  if (error) {
    if (ALREADY_RESOLVED.test(error.message) || NOT_FOUND.test(error.message)) {
      revalidatePath("/today");
      return { error: "Esa duda ya estaba cerrada" };
    }
    return {
      error: KNOWN_ERRORS[error.message] ?? "No se pudo cerrar la duda",
    };
  }

  revalidatePath("/today");
  return { success: true };
}

// Textos que lanzan void_entry / void_payment / void_product_sale. Cualquier otro error se muestra genérico
// para no filtrar mensajes crudos de Postgres a la interfaz.
const VOID_NOT_ALLOWED = /Solo un administrador/;
const VOID_ALREADY = /ya estaba anulad/;
const VOID_NOT_FOUND = /No encuentro/;

export async function voidEntry(
  number: number,
  reason: string
): Promise<{ error: string } | { success: true; message: string }> {
  if (!Number.isInteger(number) || number <= 0) {
    return { error: "Pago no válido" };
  }
  const auth = await getAuthContext();
  if (!auth) return { error: "Tu sesión expiró, vuelve a entrar" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("void_entry", {
    p_number: number,
    p_voided_by: auth.profile.full_name,
    p_reason: reason.trim() || "Anulado desde el panel",
  });

  if (error) {
    if (VOID_NOT_ALLOWED.test(error.message)) {
      return {
        error:
          "Solo un administrador o quien registró el pago puede anularlo",
      };
    }
    if (VOID_ALREADY.test(error.message)) {
      revalidatePath("/today");
      return { error: "Ese pago ya estaba anulado" };
    }
    if (VOID_NOT_FOUND.test(error.message)) {
      return { error: `No encuentro el pago P${number}` };
    }
    return { error: "No se pudo anular el pago" };
  }

  const r = (data ?? {}) as {
    subscription_canceled?: boolean;
    later_subscriptions?: boolean;
    dates_recalculated?: number;
    debt_reopened?: number;
  };
  const notes: string[] = [];
  if (r.subscription_canceled) notes.push("la membresía quedó cancelada");
  if (r.debt_reopened && r.debt_reopened > 0)
    notes.push("la deuda se reabrió");
  if (r.dates_recalculated && r.dates_recalculated > 0)
    notes.push(`se corrieron las fechas de ${r.dates_recalculated} membresía(s)`);
  if (r.later_subscriptions && !r.dates_recalculated)
    notes.push("revisa las membresías posteriores del cliente");

  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath("/debtors");
  return {
    success: true,
    message:
      `P${number} anulado` + (notes.length ? `: ${notes.join(", ")}` : ""),
  };
}
