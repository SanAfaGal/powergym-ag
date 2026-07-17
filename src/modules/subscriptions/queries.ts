import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "pending_payment"
  | "scheduled"
  | "canceled";

export type Subscription = {
  id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  base_price: number;
  discount_amount: number | null;
  final_price: number;
  cancellation_date: string | null;
  cancellation_reason: string | null;
  created_at: string;
};

export type SubscriptionPayment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  bank_account_id: string | null;
};

export type SubscriptionRow = Subscription & {
  plan_name: string;
  paid: number;
  remaining: number;
  payments: SubscriptionPayment[];
};

export type PlanOption = { id: string; name: string; price: number | null };
export type PaymentType = {
  code: string;
  name: string;
  requires_bank_account: boolean;
};
export type CatalogEntry = { code: string; name: string };

function sumPayments(payments: { amount: number }[] | null) {
  return (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
}

export async function listClientSubscriptions(
  clientId: string
): Promise<SubscriptionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "*, plans(name), payments(id, amount, payment_method, payment_date, notes, bank_account_id)"
    )
    .eq("client_id", clientId)
    .order("start_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { plans, payments, ...subscription } = row as Subscription & {
      plans: { name: string } | null;
      payments: SubscriptionPayment[] | null;
    };
    const paid = sumPayments(payments);
    const sortedPayments = [...(payments ?? [])].sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    return {
      ...subscription,
      plan_name: plans?.name ?? "",
      paid,
      remaining: Math.max(subscription.final_price - paid, 0),
      payments: sortedPayments,
    };
  });
}

// React's cache() rather than next/cache's unstable_cache() -- see the note
// on listDocumentTypes in src/modules/clients/queries.ts for why.
export const listActivePlansWithPrice = cache(async (): Promise<PlanOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plans_with_current_price", {
    p_active_only: true,
  });

  if (error) throw error;

  return (
    (data ?? []) as { id: string; name: string; current_price: number | null }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    price: row.current_price,
  }));
});

// React's cache() rather than next/cache's unstable_cache() -- see the note
// on listDocumentTypes in src/modules/clients/queries.ts for why.
export const listPaymentTypes = cache(async (): Promise<PaymentType[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_types")
    .select("code, name, requires_bank_account")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as PaymentType[];
});
